import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { PrompterSettings, TokenizedWord } from '../types/prompter';
import { HIGHLIGHT_PALETTE, getActiveSpeed, formatDuration } from '../types/prompter';
import { AudioWaveform } from './AudioWaveform';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Crosshair, EyeOff, Play, Pause, Mic, MicOff, X, Clock, MousePointerClick, ChevronUp, ChevronDown, Timer } from 'lucide-react';
import { getTranslations } from '../i18n/translations';

interface IslandPrompterProps {
  words: TokenizedWord[];
  currentWordIndex: number;
  isPlaying: boolean;
  isSpeaking: boolean;
  isMicActive: boolean;
  frequencyData: number[];
  isModelLoading?: boolean;
  isModelReady?: boolean;
  settings: PrompterSettings;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onJumpToWord: (index: number) => void;
  onClose: () => void;
  onUpdateSettings: (newSettings: Partial<PrompterSettings>) => void;
  elapsedSeconds?: number;
  currentChapterTitle?: string;
  directorMessage?: string | null;
  onNextChapter?: () => void;
  onPrevChapter?: () => void;
}


export const IslandPrompter: React.FC<IslandPrompterProps> = ({
  words,
  currentWordIndex,
  isPlaying,
  isSpeaking,
  isMicActive,
  frequencyData,
  isModelLoading = false,
  isModelReady = false,
  settings,
  onTogglePlay,
  onToggleMute,
  onJumpToWord,
  onClose,
  onUpdateSettings,
  elapsedSeconds = 0,
  currentChapterTitle,
  directorMessage,
  onNextChapter,
  onPrevChapter,
}) => {
  const t = getTranslations(settings.appLanguage || 'tr');
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const isClosingRef = useRef(false);

  // Hook into native OS window controls when in Tauri
  useEffect(() => {
    if (isTauri()) {
      invoke('enter_island_mode', {
        width: Number(settings.islandWidth || 560),
        height: Number(settings.islandHeight || 165),
      }).catch((err) => {
        console.warn('enter_island_mode failed:', err);
      });
    }

    return () => {
      if (isTauri()) {
        invoke('exit_island_mode').catch(() => {});
      }
    };
  }, []);

  // Automatically remember the window width and height when user resizes it by dragging borders
  useEffect(() => {
    let resizeTimer: number;

    const handleResize = () => {
      if (isClosingRef.current || isDockedRef.current) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (isClosingRef.current || isDockedRef.current) return;
        const currentWidth = Math.round(window.innerWidth);
        const currentHeight = Math.round(window.innerHeight);

        // Ensure we only store valid Island dimensions (excluding the large 1200x800 editor dimensions during exit)
        if (currentWidth >= 280 && currentWidth <= 1100 && currentHeight >= 90 && currentHeight <= 600) {
          onUpdateSettings({
            islandWidth: currentWidth,
            islandHeight: currentHeight,
          });
        }
      }, 200);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [onUpdateSettings]);

  const [isClickThrough, setIsClickThrough] = useState<boolean>(Boolean(settings.clickThrough));
  const [showClickThroughToast, setShowClickThroughToast] = useState<boolean>(false);
  const toastTimeoutRef = useRef<number | null>(null);

  // Enable click-through on mount if configured in settings
  useEffect(() => {
    if (settings.clickThrough && isTauri()) {
      invoke('set_click_through', { enabled: true }).catch((err) => {
        console.warn('set_click_through failed on mount:', err);
      });
    }
  }, []);

  // Sync click-through with settings prop if it changes
  useEffect(() => {
    if (settings.clickThrough !== undefined && settings.clickThrough !== isClickThrough) {
      setIsClickThrough(settings.clickThrough);
      if (isTauri()) {
        invoke('set_click_through', { enabled: settings.clickThrough }).catch((err) => {
          console.warn('set_click_through failed:', err);
        });
      }
    }
  }, [settings.clickThrough]);

  // Auto-hide the click-through banner after 2 seconds
  useEffect(() => {
    if (isClickThrough) {
      setShowClickThroughToast(true);
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = window.setTimeout(() => {
        setShowClickThroughToast(false);
      }, 2000);
    } else {
      setShowClickThroughToast(false);
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    }
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [isClickThrough]);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const onUpdateSettingsRef = useRef(onUpdateSettings);
  onUpdateSettingsRef.current = onUpdateSettings;

  const onTogglePlayRef = useRef(onTogglePlay);
  onTogglePlayRef.current = onTogglePlay;
  const onToggleMuteRef = useRef(onToggleMute);
  onToggleMuteRef.current = onToggleMute;
  const onNextChapterRef = useRef(onNextChapter);
  onNextChapterRef.current = onNextChapter;
  const onPrevChapterRef = useRef(onPrevChapter);
  onPrevChapterRef.current = onPrevChapter;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isFollowingCursor = Boolean(settings.followCursor);
  const currentWindowPos = useRef<{ x: number; y: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  const toggleClickThrough = useCallback(() => {
    setIsClickThrough((prev) => {
      const next = !prev;
      if (isTauri()) {
        invoke('set_click_through', { enabled: next }).catch((err) => {
          console.warn('set_click_through failed:', err);
        });
      }
      onUpdateSettingsRef.current({ clickThrough: next });
      return next;
    });
  }, []);
  const toggleClickThroughRef = useRef(toggleClickThrough);
  toggleClickThroughRef.current = toggleClickThrough;

  const handleClose = useCallback(async () => {
    isClosingRef.current = true;
    if (isTauri()) {
      try {
        await invoke('set_click_through', { enabled: false });
        await invoke('set_screen_capture_protection', { enabled: false });
        await invoke('exit_island_mode');
      } catch {}
    }
    onCloseRef.current();
  }, []);
  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;

  const toggleScreenCaptureProtection = useCallback(() => {
    const next = !Boolean(settingsRef.current.hideFromScreenCapture);
    onUpdateSettingsRef.current({ hideFromScreenCapture: next });
  }, []);
  const toggleScreenCaptureProtectionRef = useRef(toggleScreenCaptureProtection);
  toggleScreenCaptureProtectionRef.current = toggleScreenCaptureProtection;

  const toggleFollowCursor = useCallback(() => {
    const next = !Boolean(settingsRef.current.followCursor);
    onUpdateSettingsRef.current({ followCursor: next });
  }, []);
  const toggleFollowCursorRef = useRef(toggleFollowCursor);
  toggleFollowCursorRef.current = toggleFollowCursor;

  const [isDocked, setIsDocked] = useState<boolean>(false);
  const isDockedRef = useRef(isDocked);
  isDockedRef.current = isDocked;

  const handleToggleDock = useCallback(() => {
    const nextState = !isDockedRef.current;
    isDockedRef.current = nextState;
    setIsDocked(nextState);

    if (isTauri()) {
      const w = Number(settingsRef.current.islandWidth || 560);
      const h = Number(settingsRef.current.islandHeight || 165);
      invoke('set_island_docked', {
        collapsed: nextState,
        width: w < 400 ? 560 : w,
        height: h < 120 ? 165 : h,
      }).catch((err) => {
        console.warn('set_island_docked failed:', err);
      });
    }
  }, []);
  const handleToggleDockRef = useRef(handleToggleDock);
  handleToggleDockRef.current = handleToggleDock;

  const [inPrompterCountdown, setInPrompterCountdown] = useState<number | null>(null);

  const startInPrompterCountdown = useCallback(() => {
    if (isPlaying) {
      onTogglePlay();
    }
    const initialDuration = Number(settingsRef.current.countdownDuration || 3);
    setInPrompterCountdown(initialDuration);
  }, [isPlaying, onTogglePlay]);

  const cancelInPrompterCountdown = useCallback(() => {
    setInPrompterCountdown(null);
  }, []);

  // In-prompter countdown tick effect
  useEffect(() => {
    if (inPrompterCountdown === null) return;

    if (inPrompterCountdown <= 0) {
      setInPrompterCountdown(null);
      if (!isPlaying) {
        onTogglePlay();
      }
      return;
    }

    const timer = window.setTimeout(() => {
      setInPrompterCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [inPrompterCountdown, isPlaying, onTogglePlay]);

  // Listen for global background shortcuts emitted by Rust backend (registered strictly ONCE on mount)
  useEffect(() => {
    if (!isTauri()) return;

    let isDisposed = false;
    const unlistens: (() => void)[] = [];

    const setupListeners = async () => {
      try {
        const u1 = await listen('global-shortcut-toggle-clickthrough', () => {
          toggleClickThroughRef.current();
        });
        if (isDisposed) { u1(); return; }
        unlistens.push(u1);

        const u2 = await listen('global-shortcut-toggle-follow-cursor', () => {
          toggleFollowCursorRef.current();
        });
        if (isDisposed) { u2(); return; }
        unlistens.push(u2);

        const u3 = await listen('global-shortcut-toggle-ghost-mode', () => {
          toggleScreenCaptureProtectionRef.current();
        });
        if (isDisposed) { u3(); return; }
        unlistens.push(u3);

        const u4 = await listen('global-shortcut-toggle-play', () => {
          onTogglePlayRef.current();
        });
        if (isDisposed) { u4(); return; }
        unlistens.push(u4);

        const u5 = await listen('global-shortcut-close', () => {
          handleCloseRef.current();
        });
        if (isDisposed) { u5(); return; }
        unlistens.push(u5);

        const u6 = await listen('global-shortcut-next-chapter', () => {
          onNextChapterRef.current?.();
        });
        if (isDisposed) { u6(); return; }
        unlistens.push(u6);

        const u7 = await listen('global-shortcut-prev-chapter', () => {
          onPrevChapterRef.current?.();
        });
        if (isDisposed) { u7(); return; }
        unlistens.push(u7);

        const u8 = await listen('global-shortcut-toggle-mic', () => {
          onToggleMuteRef.current();
        });
        if (isDisposed) { u8(); return; }
        unlistens.push(u8);

        const u9 = await listen('global-shortcut-toggle-dock', () => {
          handleToggleDockRef.current();
        });
        if (isDisposed) { u9(); return; }
        unlistens.push(u9);
      } catch (err) {
        console.warn('Failed to register global shortcut listeners:', err);
      }
    };

    setupListeners();

    return () => {
      isDisposed = true;
      unlistens.forEach((u) => u());
      if (isTauri()) {
        invoke('set_click_through', { enabled: false }).catch(() => {});
      }
    };
  }, []);

  // Continuous smooth cursor glide when isFollowingCursor is active
  useEffect(() => {
    if (!isFollowingCursor || !isTauri()) {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    let isPolling = true;
    let targetPos = { x: 0, y: 0 };
    let hasTarget = false;

    // Periodically poll cursor position (every ~45ms)
    const cursorPollInterval = window.setInterval(async () => {
      if (isDraggingRef.current || isClosingRef.current || !isPolling) return;
      try {
        const [mouseX, mouseY] = await invoke<[number, number]>('get_cursor_position');
        const winW = window.innerWidth || (settings.islandWidth || 560);
        const winH = window.innerHeight || (settings.islandHeight || 165);

        // Position prompter centered horizontally with cursor, and slightly below cursor
        const tx = Math.max(10, mouseX - (winW / 2));
        const maxH = window.screen.availHeight || 1080;
        const ty = mouseY + winH + 50 > maxH
          ? Math.max(10, mouseY - winH - 25)
          : mouseY + 30;

        targetPos = { x: tx, y: ty };
        hasTarget = true;
      } catch {}
    }, 45);

    // Smooth animation loop that glides window toward target position with easing
    const glide = async () => {
      if (!isPolling || isClosingRef.current) return;

      if (hasTarget && !isDraggingRef.current) {
        if (!currentWindowPos.current) {
          currentWindowPos.current = { ...targetPos };
          await invoke('set_window_position', { x: targetPos.x, y: targetPos.y }).catch(() => {});
        } else {
          const dx = targetPos.x - currentWindowPos.current.x;
          const dy = targetPos.y - currentWindowPos.current.y;
          const dist = Math.hypot(dx, dy);

          // Smooth exponential damping glide
          if (dist > 3) {
            const ease = 0.18;
            currentWindowPos.current.x += dx * ease;
            currentWindowPos.current.y += dy * ease;

            await invoke('set_window_position', {
              x: Math.round(currentWindowPos.current.x),
              y: Math.round(currentWindowPos.current.y),
            }).catch(() => {});
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(glide);
    };

    animFrameRef.current = requestAnimationFrame(glide);

    return () => {
      isPolling = false;
      clearInterval(cursorPollInterval);
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isFollowingCursor, settings.islandWidth, settings.islandHeight]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
    if (isTauri()) {
      invoke('start_drag').catch(() => {});
    }
    const onMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mouseup', onMouseUp);
  };

  // Local keyboard shortcuts when prompter window has focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.code === 'KeyD' || e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        handleToggleDock();
        return;
      }

      // Ignore other Alt combinations here (they are handled globally across OS by Rust backend)
      if (e.altKey) return;

      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (inPrompterCountdown !== null) {
          cancelInPrompterCountdown();
        } else if (isClickThrough) {
          toggleClickThrough();
        } else {
          handleClose();
        }
      } else if (e.code === 'PageDown' || e.code === 'BracketRight') {
        e.preventDefault();
        onNextChapter?.();
      } else if (e.code === 'PageUp' || e.code === 'BracketLeft') {
        e.preventDefault();
        onPrevChapter?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, toggleClickThrough, isClickThrough, handleClose, onNextChapter, onPrevChapter]);

  const palette = HIGHLIGHT_PALETTE[settings.highlightColor] || HIGHLIGHT_PALETTE.yellow;

  const [islandScrollPct, setIslandScrollPct] = useState<number>(0);

  // Auto-scroll inside island container
  useEffect(() => {
    if (settings.guidanceMode === 'tracking') {
      if (activeWordRef.current && containerRef.current) {
        activeWordRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
      }
      return;
    }

    if (!isPlaying) return;

    let animId: number;
    let lastTime: number | null = null;
    let currentVelocity = 0;
    const scrollPos = { current: containerRef.current?.scrollTop || 0 };

    const step = (timestamp: number) => {
      const el = containerRef.current;
      if (!el) return;

      if (lastTime === null) lastTime = timestamp;
      const delta = Math.min((timestamp - lastTime) / 1000, 0.1);
      lastTime = timestamp;

      const isPaused = settings.guidanceMode === 'voice-activated' && !isSpeaking;
      const activeSpeed = getActiveSpeed(settings);
      const fontScale = Math.max(0.6, Math.min(2.5, (settings.fontSize || 38) / 38));
      const baseSpeed = 3.75 + activeSpeed * 0.75;
      const fullVelocity = baseSpeed * fontScale;
      const targetVelocity = isPaused ? 0 : fullVelocity;

      const blendRate = targetVelocity > currentVelocity ? 18 : 10;
      currentVelocity += (targetVelocity - currentVelocity) * Math.min(1, blendRate * delta);

      if (Math.abs(currentVelocity) < 0.2 && targetVelocity === 0) {
        currentVelocity = 0;
      }

      if (currentVelocity > 0) {
        scrollPos.current += currentVelocity * delta;
        el.scrollTop = scrollPos.current;

        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll > 0) {
          setIslandScrollPct(Math.min(100, Math.round((el.scrollTop / maxScroll) * 100)));
        }
      }

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [
    settings.guidanceMode,
    settings.speed,
    settings.classicSpeed,
    settings.voiceSpeed,
    settings.fontSize,
    isPlaying,
    isSpeaking,
    currentWordIndex,
  ]);

  const rawPercent = words.length > 1 ? Math.round((currentWordIndex / (words.length - 1)) * 100) : 0;
  const progressPercent =
    settings.guidanceMode === 'tracking'
      ? (isNaN(rawPercent) ? 0 : Math.min(100, Math.max(0, rawPercent)))
      : islandScrollPct;

  // Transparency percentage: 0% (solid dark capsule) to 100% (fully transparent background/chrome, text only)
  const transparency = typeof settings.islandTransparency === 'number'
    ? settings.islandTransparency
    : typeof settings.islandOpacity === 'number' && settings.islandOpacity <= 100
    ? (settings.islandOpacity > 50 ? 100 - settings.islandOpacity : settings.islandOpacity)
    : 0;
  const clampedTransparency = Math.max(0, Math.min(100, transparency));
  const chromeAlpha = Math.max(0, 1 - (clampedTransparency / 100));

  // When cursor-follow mode is active or while actively dragging, never trigger hover chrome on mouse movements
  const showHoverChrome = isHovered && !isFollowingCursor && !isDraggingRef.current;

  return (
    <div
      className={`w-screen h-screen bg-transparent select-none flex items-start justify-center m-0 p-0 overflow-hidden ${
        isDocked ? 'cursor-pointer' : ''
      }`}
      onMouseEnter={() => {
        if (!isFollowingCursor && !isDraggingRef.current) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isDocked ? (
        /* Sadece Ok İkonu (Arka plan, kutu, kenarlık yok) */
        <div
          onClick={handleToggleDock}
          className="w-full h-full bg-transparent flex items-center justify-center cursor-pointer select-none p-1"
          title={t.expandFromNotch || "Prompter'ı Aç (Tıkla / Alt + D)"}
        >
          <ChevronDown
            className="w-6 h-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] hover:scale-125 transition-transform animate-bounce active:scale-95"
            strokeWidth={2.5}
          />
        </div>
      ) : (
        /* Dynamic Island Capsule Container */
        <div
          className={`w-full h-full relative border rounded-xl overflow-hidden flex flex-col justify-between transition-all duration-200 ${
            isClickThrough
              ? 'border-white/40 ring-1 ring-white/20'
              : ''
          }`}
        style={{
          backgroundColor: showHoverChrome && chromeAlpha < 0.15
            ? 'rgba(17, 17, 17, 0.25)'
            : `rgba(17, 17, 17, ${chromeAlpha * 0.95})`,
          borderColor: isClickThrough
            ? 'rgba(255, 255, 255, 0.4)'
            : showHoverChrome && chromeAlpha < 0.2
            ? 'rgba(46, 46, 50, 0.4)'
            : `rgba(46, 46, 50, ${chromeAlpha})`,
          boxShadow: chromeAlpha > 0.05
            ? `0 20px 40px -15px rgba(0, 0, 0, ${chromeAlpha * 0.7})`
            : 'none',
          backdropFilter: chromeAlpha > 0.1
            ? `blur(${chromeAlpha * 12}px)`
            : 'none',
        }}
      >
        {/* Progress Line */}
        <div
          className="absolute top-0 left-0 w-full h-[2px] z-20 transition-opacity duration-200"
          style={{
            backgroundColor: `rgba(34, 34, 34, ${showHoverChrome ? 0.8 : chromeAlpha})`,
            opacity: showHoverChrome ? 0.9 : (clampedTransparency >= 85 ? 0 : chromeAlpha),
          }}
        >
          <div
            className="h-full bg-white transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Top Control Bar */}
        <div
          onMouseDown={handleDragStart}
          className="flex items-center justify-between px-3 py-2 border-b text-xs cursor-grab active:cursor-grabbing gap-1.5 select-none min-w-0 transition-all duration-200"
          style={{
            backgroundColor: showHoverChrome
              ? 'rgba(20, 20, 22, 0.95)'
              : `rgba(20, 20, 22, ${chromeAlpha * 0.95})`,
            borderBottomColor: showHoverChrome
              ? 'rgba(34, 34, 34, 0.8)'
              : `rgba(34, 34, 34, ${chromeAlpha})`,
            opacity: showHoverChrome ? 1 : (clampedTransparency >= 85 ? 0 : chromeAlpha),
            pointerEvents: (!showHoverChrome && clampedTransparency >= 85) ? 'none' : 'auto',
          }}
          title={t.dragToMove}
        >
          {/* Left: Bi Badge & Badges */}
          <div className="flex items-center gap-1.5 min-w-0 shrink pointer-events-none">
            <div className="w-5 h-5 bg-white rounded flex items-center justify-center font-bold text-[10px] text-black shrink-0">
              Bi
            </div>
            <span className="font-semibold text-zinc-200 text-[11px] tracking-wide hidden sm:inline truncate max-w-[80px]">
              prompter
            </span>
            {currentChapterTitle && (
              <span className="text-[10px] text-zinc-300 font-medium truncate max-w-[100px] hidden md:inline px-1.5 py-0.5 rounded bg-[#1C1C1E] border border-[#2E2E32]" title={currentChapterTitle}>
                {currentChapterTitle}
              </span>
            )}
            {settings.guidanceMode === 'tracking' && isModelLoading && (
              <span className="text-[10px] text-zinc-400 font-mono animate-pulse shrink-0">
                {t.modelDownloading}
              </span>
            )}
            {settings.guidanceMode === 'tracking' && isModelReady && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#EDF3EC] text-[#346538] font-mono font-medium border border-[#D4E2D2] shrink-0">
                Vosk
              </span>
            )}
            {settings.hideFromScreenCapture && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded bg-[#1C1C1E] text-zinc-300 font-mono font-medium border border-[#2E2E32] shrink-0 hidden md:inline"
                title={t.ghostModeTooltip}
              >
                {t.badgeGhostActive}
              </span>
            )}
            {isFollowingCursor && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded bg-[#1C1C1E] text-zinc-200 font-mono font-medium border border-[#2E2E32] shrink-0 hidden md:inline"
                title={t.cursorFollowTooltip}
              >
                {t.badgeCursorActive}
              </span>
            )}
            {isClickThrough && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded bg-[#1C1C1E] text-zinc-200 font-mono font-medium border border-[#2E2E32] shrink-0 hidden md:inline"
                title="Tıklama Geçirgenliği Aktif (Alt + C)"
              >
                Alta Tıkla (Alt+C)
              </span>
            )}
          </div>

          {/* Center: Status, Audio Waveform & Live Elapsed Time */}
          <div className="flex items-center gap-1.5 pointer-events-none min-w-0 shrink mx-1">
            <AudioWaveform
              isMicActive={isMicActive}
              isSpeaking={isSpeaking}
              isMuted={settings.isMuted}
              frequencyData={frequencyData}
              color="#EAEAEA"
              size="sm"
            />
            {/* Live Elapsed Time Pill */}
            <div
              className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-zinc-200 bg-[#1C1C1E] px-1.5 py-0.5 rounded border border-[#2E2E32] shrink-0"
              title={t.elapsedTime}
            >
              <Clock className="w-3 h-3 text-zinc-400" />
              <span>{formatDuration(elapsedSeconds)}</span>
            </div>
            <span className="font-mono text-[10px] tabular-nums text-zinc-500 shrink-0 hidden xs:inline">
              {currentWordIndex + 1}/{words.length}
            </span>
          </div>

          {/* Right Actions - Fixed & Always Visible */}
          <div className="flex items-center gap-1 shrink-0 z-10 ml-auto" onMouseDown={(e) => e.stopPropagation()}>
            {/* Mouse Cursor Follow Mode Toggle */}
            <button
              onClick={toggleFollowCursor}
              className={`p-1.5 rounded-md border transition-all shrink-0 ${
                isFollowingCursor
                  ? 'bg-white border-white text-black font-semibold'
                  : 'bg-[#1C1C1E] border-[#2E2E32] hover:bg-[#2A2A2E] text-zinc-400 hover:text-white'
              }`}
              title={`${t.cursorFollowTooltip} (Alt + M)`}
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>

            {/* Screen Capture Protection (Ghost Mode) Toggle */}
            <button
              onClick={toggleScreenCaptureProtection}
              className={`p-1.5 rounded-md border transition-all shrink-0 ${
                settings.hideFromScreenCapture
                  ? 'bg-white border-white text-black font-semibold'
                  : 'bg-[#1C1C1E] border-[#2E2E32] hover:bg-[#2A2A2E] text-zinc-400 hover:text-zinc-200'
              }`}
              title={`${t.ghostModeTooltip} (Alt + G)`}
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>

            {/* Click-Through Mode (Fareyi Alta Geçir) Toggle */}
            <button
              onClick={toggleClickThrough}
              className={`p-1.5 rounded-md border transition-all shrink-0 ${
                isClickThrough
                  ? 'bg-white border-white text-black font-semibold'
                  : 'bg-[#1C1C1E] border-[#2E2E32] hover:bg-[#2A2A2E] text-zinc-400 hover:text-zinc-200'
              }`}
              title={
                isClickThrough
                  ? 'Tıklama Geçirgenliği Aktif (Çıkış: Alt + C)'
                  : 'Fareyi Alta Geçir (Tıklama Geçirgenliği) (Alt + C)'
              }
            >
              <MousePointerClick className="w-3.5 h-3.5" />
            </button>

            {/* In-Prompter Countdown Button */}
            <button
              onClick={startInPrompterCountdown}
              className={`p-1.5 rounded-md border transition-all shrink-0 active:scale-95 ${
                inPrompterCountdown !== null
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold'
                  : 'bg-[#1C1C1E] border-[#2E2E32] hover:bg-[#2A2A2E] text-zinc-400 hover:text-white'
              }`}
              title="Geri Sayım Başlat (3sn)"
            >
              <Timer className="w-3.5 h-3.5" />
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={onTogglePlay}
              className="p-1.5 rounded-md border border-[#2E2E32] bg-[#1C1C1E] hover:bg-[#2A2A2E] text-zinc-200 hover:text-white transition-all shrink-0"
              title={`${t.playPauseTooltip} (Alt + P / Boşluk)`}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-zinc-200" />
              ) : (
                <Play className="w-3.5 h-3.5 text-white fill-white" />
              )}
            </button>

            {/* Mic Toggle Button */}
            <button
              onClick={onToggleMute}
              className={`p-1.5 rounded-md border transition-all shrink-0 ${
                settings.isMuted
                  ? 'bg-[#FDEBEC] border-[#F0D2D4] text-[#9F2F2D]'
                  : 'bg-[#1C1C1E] border-[#2E2E32] hover:bg-[#2A2A2E] text-zinc-200'
              }`}
              title={`${settings.isMuted ? t.micToggleUnmute : t.micToggleMute} (Alt + S)`}
            >
              {settings.isMuted ? (
                <MicOff className="w-3.5 h-3.5" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-zinc-300" />
              )}
            </button>

            {/* Collapse to Top Notch Island Toggle */}
            <button
              onClick={handleToggleDock}
              className="p-1.5 rounded-md border border-[#2E2E32] bg-[#1C1C1E] hover:bg-[#2A2A2E] text-zinc-400 hover:text-white transition-all shrink-0 active:scale-95"
              title={t.collapseToNotch || "Ekranın Tepesine Küçült (Alt + D)"}
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="p-1.5 rounded-md bg-[#1C1C1E] hover:bg-[#FDEBEC] text-zinc-400 hover:text-[#9F2F2D] border border-[#2E2E32] hover:border-[#F0D2D4] transition-all shrink-0 active:scale-95"
              title={`${t.returnToEditor} (Alt + X / ESC)`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Director Cue Alert Overlay in Island */}
        {directorMessage && (
          <div className="absolute top-9 left-2 right-2 z-40 bg-[#18181B] border border-[#2E2E32] text-white font-medium px-3 py-1.5 rounded-md shadow-lg flex items-center justify-between text-xs animate-in fade-in duration-200">
            <span className="flex items-center gap-1.5 truncate">
              <span className="text-zinc-400 font-mono text-[10px] uppercase font-semibold">REJİ:</span>
              <span className="truncate text-white">{directorMessage}</span>
            </span>
          </div>
        )}

        {/* Click-Through Mode Auto-Hiding Notification Toast */}
        {showClickThroughToast && (
          <div className="absolute top-10 left-2 right-2 z-40 bg-[#161616]/95 border border-white/20 text-[#EDEDED] px-3 py-1 rounded-md shadow-xl flex items-center justify-between text-xs pointer-events-none select-none backdrop-blur-md transition-all duration-300">
            <div className="flex items-center gap-2 truncate">
              <MousePointerClick className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="font-medium truncate text-[#EDEDED] text-[11px]">
                Fare tıklamaları alttaki ekrana geçiyor
              </span>
            </div>
            <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded border border-white/20 text-white shrink-0">
              Çıkış: Alt + C
            </span>
          </div>
        )}

        {/* In-Prompter 3.. 2.. 1.. Countdown Overlay */}
        {inPrompterCountdown !== null && (
          <div
            onClick={cancelInPrompterCountdown}
            className="absolute inset-0 z-40 bg-[#0B0B0C]/85 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-150 cursor-pointer select-none"
            title="Geri sayımı iptal etmek için tıkla (ESC)"
          >
            <div className="text-4xl font-black text-white tracking-widest animate-pulse font-mono drop-shadow-md">
              {inPrompterCountdown > 0 ? inPrompterCountdown : 'BAŞLA!'}
            </div>
            <span className="text-[10px] text-zinc-400 font-medium mt-1">
              Hazırlanın... (İptal için tıkla)
            </span>
          </div>
        )}

        {/* Word Stream Area (Dynamic Reading Island) */}
        <div
          ref={containerRef}
          dir={settings.appLanguage === 'ar' || settings.speechLanguage === 'ar-SA' ? 'rtl' : 'ltr'}
          className="flex-1 px-4 py-2 overflow-y-auto overflow-x-hidden font-medium leading-relaxed"
          style={{
            fontSize: '18px',
            textAlign: settings.alignment,
            textShadow: clampedTransparency > 15
              ? '0 1px 2px rgba(0, 0, 0, 0.85), 0 2px 6px rgba(0, 0, 0, 0.6)'
              : 'none',
          }}
        >
          {settings.guidanceMode === 'tracking' ? (
            <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 w-full min-h-full py-1">
              {words.map((w, idx) => {
                const isActive = idx === currentWordIndex;
                const isPast = idx < currentWordIndex;

                if (w.isCue) {
                  return (
                    <span
                      key={w.id}
                      onClick={() => onJumpToWord(idx)}
                      className={`select-none italic font-normal px-1 inline-block transition-colors cursor-pointer ${
                        isPast
                          ? clampedTransparency > 40
                            ? 'text-zinc-500/60'
                            : 'text-zinc-600'
                          : clampedTransparency > 40
                          ? 'text-zinc-400/80 hover:text-zinc-300'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                      style={{
                        textShadow: clampedTransparency > 15 ? '0 1px 2px rgba(0, 0, 0, 0.6)' : 'none',
                      }}
                      title={`Yönerge: ${w.text} (Konuşulmaz, atlanır)`}
                    >
                      {w.text}
                    </span>
                  );
                }

                return (
                  <span
                    key={w.id}
                    ref={isActive ? activeWordRef : null}
                    onClick={() => onJumpToWord(idx)}
                    className={`cursor-pointer transition-all duration-150 inline-block px-1.5 py-0.5 rounded ${
                      isActive
                        ? `${palette.bg} ${palette.text} font-semibold scale-105 z-10 shadow-md ring-1 ring-black/10`
                        : isPast
                        ? clampedTransparency > 40
                          ? 'text-zinc-400 hover:text-zinc-200 font-medium'
                          : 'text-zinc-500 hover:text-zinc-300'
                        : clampedTransparency > 40
                        ? 'text-white hover:text-white font-medium'
                        : 'text-zinc-200 hover:text-white'
                    }`}
                    style={isActive ? { textShadow: 'none' } : undefined}
                    title={`Kelime ${idx + 1}: "${w.text}" (Tıkla ve buradan oku)`}
                  >
                    {w.text}
                  </span>
                );
              })}
            </div>
          ) : (
            <div
              className={`w-full py-6 px-2 whitespace-pre-wrap leading-relaxed ${
                clampedTransparency > 40 ? 'text-white font-medium' : 'text-zinc-200'
              }`}
            >
              {words.map((w) => {
                if (w.isCue) {
                  return (
                    <span
                      key={w.id}
                      className={`select-none italic font-normal px-1 inline-block ${
                        clampedTransparency > 40 ? 'text-zinc-400/80' : 'text-zinc-400'
                      }`}
                      style={{
                        textShadow: clampedTransparency > 15 ? '0 1px 2px rgba(0, 0, 0, 0.6)' : 'none',
                      }}
                      title={`Yönerge: ${w.text} (Konuşulmaz)`}
                    >
                      {w.text}{' '}
                    </span>
                  );
                }
                return (
                  <React.Fragment key={w.id}>
                    {w.text}{' '}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Controls on Hover */}
        {showHoverChrome && (
          <div
            className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-1.5 border-t text-[10px] text-zinc-300 animate-fadeIn backdrop-blur-md transition-all duration-200 shadow-lg"
            style={{
              backgroundColor: 'rgba(20, 20, 22, 0.95)',
              borderColor: 'rgba(46, 46, 50, 0.8)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-zinc-300 font-medium">{t.islandOpacity}:</span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={clampedTransparency}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateSettings({
                    islandTransparency: val,
                    islandOpacity: 100 - val,
                  });
                }}
                className="w-24 h-1 accent-white bg-zinc-700 rounded cursor-pointer"
              />
              <span className="font-mono tabular-nums text-zinc-200 text-[10px] font-medium min-w-[28px]">
                %{clampedTransparency}
              </span>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
