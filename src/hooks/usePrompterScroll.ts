import { useState, useEffect, useRef, useCallback } from 'react';

interface UsePrompterScrollProps {
  speed: number; // 1 - 50
  fontSize?: number;
  isPaused?: boolean;
  autoPlay?: boolean;
  onFinished?: () => void;
}

export function usePrompterScroll({
  speed,
  fontSize = 38,
  isPaused = false,
  autoPlay = true,
  onFinished,
}: UsePrompterScrollProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // High-precision subpixel scroll accumulator
  const scrollPosRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = fontSize;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  // Velocity smoothing: smoothly accelerates when speech starts and decelerates when speech pauses
  const currentVelocityRef = useRef<number>(0);

  const updateProgress = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) {
      setScrollProgress(0);
      return;
    }
    const current = el.scrollTop;
    const pct = Math.min(100, Math.max(0, (current / maxScroll) * 100));
    setScrollProgress(Math.round(pct));
  }, []);

  const stopAnimation = useCallback(() => {
    if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    lastTimeRef.current = null;
    currentVelocityRef.current = 0;
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
    stopAnimation();
  }, [stopAnimation]);

  const play = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (el.scrollTop >= maxScroll - 5) {
        el.scrollTop = 0;
        scrollPosRef.current = 0;
        setIsFinished(false);
      } else {
        scrollPosRef.current = el.scrollTop;
      }
    }

    setIsPlaying(true);
    setIsFinished(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const resetToTop = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
      scrollPosRef.current = 0;
      currentVelocityRef.current = 0;
      updateProgress();
    }
    setIsFinished(false);
  }, [updateProgress]);

  const seek = useCallback((percentage: number) => {
    const el = containerRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    const target = (percentage / 100) * maxScroll;
    el.scrollTop = target;
    scrollPosRef.current = target;
    updateProgress();
  }, [updateProgress]);

  // Sync scroll position if user scrolls manually
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    scrollPosRef.current = el.scrollTop;
    updateProgress();
  }, [updateProgress]);

  // The requestAnimationFrame loop with broadcast-grade velocity smoothing
  useEffect(() => {
    if (!isPlaying) {
      stopAnimation();
      return;
    }

    const step = (timestamp: number) => {
      const el = containerRef.current;
      if (!el) return;

      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }

      // Delta time in seconds, capped at 0.1s to prevent huge jumps
      const delta = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      // Human-calibrated scroll speed:
      // Line height at 38px font is ~60px.
      // Average speech tempo is ~130 WPM (~8 words/line -> ~3.7s per line -> ~16 px/s).
      // Speed 1: ~4.5 px/s (ultra-slow crawl, ~36 WPM)
      // Speed 5: ~7.5 px/s (relaxed/slow, ~60 WPM)
      // Speed 18: ~17.25 px/s (natural/default, ~138 WPM)
      // Speed 30: ~26.25 px/s (dynamic, ~210 WPM)
      // Speed 50: ~41.25 px/s (fast)
      // fontScale scales proportionally with font size so perceived reading speed stays constant
      const fontScale = Math.max(0.6, Math.min(2.5, (fontSizeRef.current || 38) / 38));
      const baseSpeed = 3.75 + speedRef.current * 0.75;
      const fullVelocity = baseSpeed * fontScale;
      const targetVelocity = isPausedRef.current ? 0 : fullVelocity;

      // Asymmetric acceleration/deceleration:
      // Accelerates quickly (~80ms) when voice detected
      // Decelerates gently (~160ms) when voice pauses for natural broadcast feel
      const blendRate = targetVelocity > currentVelocityRef.current ? 18 : 10;
      const velocityChange = (targetVelocity - currentVelocityRef.current) * Math.min(1, blendRate * delta);
      currentVelocityRef.current += velocityChange;

      if (Math.abs(currentVelocityRef.current) < 0.2 && targetVelocity === 0) {
        currentVelocityRef.current = 0;
      }

      if (currentVelocityRef.current > 0) {
        scrollPosRef.current += currentVelocityRef.current * delta;
        el.scrollTop = scrollPosRef.current;
        updateProgress();

        const maxScroll = el.scrollHeight - el.clientHeight;
        if (el.scrollTop >= maxScroll - 2) {
          setIsPlaying(false);
          setIsFinished(true);
          stopAnimation();
          if (onFinished) onFinished();
          return;
        }
      }

      animFrameIdRef.current = requestAnimationFrame(step);
    };

    animFrameIdRef.current = requestAnimationFrame(step);

    return () => {
      stopAnimation();
    };
  }, [isPlaying, onFinished, stopAnimation, updateProgress]);

  return {
    containerRef,
    isPlaying,
    setIsPlaying,
    scrollProgress,
    isFinished,
    play,
    pause,
    togglePlay,
    resetToTop,
    seek,
    handleScroll,
  };
}
