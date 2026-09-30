import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ScriptData, PrompterSettings } from '../types/prompter';
import { HIGHLIGHT_PALETTE, getActiveSpeed, speedToWpm } from '../types/prompter';
import { usePrompterScroll } from '../hooks/usePrompterScroll';
import { useAudioVisualizer } from '../hooks/useAudioVisualizer';
import { useSpeechTracker } from '../hooks/useSpeechTracker';
import { IslandPrompter } from './IslandPrompter';
import { ChaptersDrawer } from './ChaptersDrawer';
import { DirectorConsole } from './DirectorConsole';
import { parseChapters, getActiveChapter, Chapter } from '../utils/chapterParser';
import { invoke, isTauri } from '@tauri-apps/api/core';

interface PrompterViewProps {
  script: ScriptData;
  settings: PrompterSettings;
  onUpdateSettings: (updater: (prev: PrompterSettings) => PrompterSettings) => void;
  onReturnToEditor: (elapsedSeconds?: number) => void;
}

export const PrompterView: React.FC<PrompterViewProps> = ({
  script,
  settings,
  onUpdateSettings,
  onReturnToEditor,
}) => {
  const [hudVisible, setHudVisible] = useState<boolean>(true);
  const idleTimeoutRef = useRef<number | null>(null);
  const activeWordSpanRef = useRef<HTMLSpanElement>(null);

  // Modals & Panels state
  const [isChaptersOpen, setIsChaptersOpen] = useState(false);
  const [isDirectorOpen, setIsDirectorOpen] = useState(false);
  const [directorCue, setDirectorCue] = useState<string | null>(null);
  const cueTimeoutRef = useRef<number | null>(null);

  // Audio Visualizer & Voice Activity Detection
  const {
    isMicActive,
    isSpeaking,
    frequencyData,
    audioContext,
    mediaStream,
    startMic,
    stopMic,
  } = useAudioVisualizer({
    enabled: settings.guidanceMode !== 'classic',
    sensitivity: settings.micSensitivity,
    isMuted: settings.isMuted,
  });

  // Start microphone if guidance requires it
  useEffect(() => {
    if (settings.guidanceMode !== 'classic') {
      startMic();
    } else {
      stopMic();
    }
  }, [settings.guidanceMode, startMic, stopMic]);

  // Screen Capture Protection (Ghost Mode for OBS/Zoom/Teams)
  useEffect(() => {
    if (isTauri()) {
      invoke('set_screen_capture_protection', {
        enabled: Boolean(settings.hideFromScreenCapture),
      }).catch((err) => {
        console.warn('set_screen_capture_protection failed:', err);
      });
    }

    return () => {
      if (isTauri()) {
        invoke('set_screen_capture_protection', { enabled: false }).catch(() => {});
      }
    };
  }, [settings.hideFromScreenCapture]);

  // Scroll engine control:
  // In tracking mode: paused (PromptMatcher controls active word and scrolls to eyeline)
  // In voice-activated mode: paused when not speaking (!isSpeaking), flows continuously when speaking
  // In classic mode: unpaused (flows continuously at set speed)
  const isScrollEnginePaused =
    settings.guidanceMode === 'tracking'
      ? true
      : settings.guidanceMode === 'voice-activated'
      ? !isSpeaking
      : false;

  const activeSpeed = getActiveSpeed(settings);

  const {
    containerRef,
    isPlaying,
    setIsPlaying,
    scrollProgress,
    isFinished,
    play,
    pause,
    togglePlay,
    resetToTop,
    handleScroll,
  } = usePrompterScroll({
    speed: activeSpeed,
    fontSize: settings.fontSize,
    isPaused: isScrollEnginePaused,
    autoPlay: settings.autoStart !== false,
  });

  // Vosk Offline Speech Recognition & Word Tracker with VAD Fallback
  const {
    words,
    currentWordIndex,
    progress: speechProgress,
    isListening,
    isModelLoading,
    isModelReady,
    jumpToWord,
    reset: resetSpeech,
  } = useSpeechTracker({
    text: script.content,
    language: settings.speechLanguage,
    isActive: isPlaying && !settings.isMuted,
    isSpeaking: isSpeaking,
    speed: activeSpeed,
    guidanceMode: settings.guidanceMode,
    audioContext,
    mediaStream,
  });

  // Live Elapsed Time Tracker (increments while prompter is playing)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    let interval: number | null = null;
    if (isPlaying) {
      interval = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval !== null) clearInterval(interval);
    };
  }, [isPlaying]);

  // Chapter Detection & Management (Using ScriptSection models or fallback parser)
  const chapters = useMemo(() => {
    if (Array.isArray(script.sections) && script.sections.length > 0) {
      let cumulativeWordIndex = 0;
      let cumulativeCharIndex = 0;
      return script.sections.map((sec, idx) => {
        const wordsInSec = sec.content ? sec.content.trim().split(/\s+/).filter(Boolean).length : 0;
        const chapter: Chapter = {
          id: sec.id,
          index: idx,
          title: sec.title || `Bölüm ${idx + 1}`,
          wordIndex: cumulativeWordIndex,
          charIndex: cumulativeCharIndex,
          startWordIndex: cumulativeWordIndex,
          startCharIndex: cumulativeCharIndex,
          wordCount: wordsInSec,
        };
        cumulativeWordIndex += wordsInSec;
        cumulativeCharIndex += (sec.content?.length || 0) + 2;
        return chapter;
      });
    }
    return parseChapters(script.content);
  }, [script.sections, script.content]);
  const activeChapter = useMemo(
    () => getActiveChapter(chapters, currentWordIndex),
    [chapters, currentWordIndex]
  );

  const handleJumpToChapter = useCallback(
    (chapter: Chapter) => {
      if (settings.guidanceMode === 'tracking') {
        jumpToWord(chapter.startWordIndex);
      } else if (containerRef.current) {
        const totalChars = Math.max(1, script.content.length);
        const scrollFraction = chapter.startCharIndex / totalChars;
        const maxScroll = containerRef.current.scrollHeight - containerRef.current.clientHeight;
        containerRef.current.scrollTo({
          top: Math.max(0, scrollFraction * maxScroll),
          behavior: 'smooth',
        });
      }
    },
    [settings.guidanceMode, jumpToWord, script.content.length, containerRef]
  );

  const handleNextChapter = useCallback(() => {
    if (!chapters.length) return;
    const currentIndex = activeChapter
      ? chapters.findIndex((c) => c.id === activeChapter.id)
      : -1;
    const nextIndex = Math.min(chapters.length - 1, currentIndex + 1);
    if (nextIndex >= 0 && nextIndex < chapters.length) {
      handleJumpToChapter(chapters[nextIndex]);
    }
  }, [chapters, activeChapter, handleJumpToChapter]);

  const handlePrevChapter = useCallback(() => {
    if (!chapters.length) return;
    const currentIndex = activeChapter
      ? chapters.findIndex((c) => c.id === activeChapter.id)
      : 0;
    const prevIndex = Math.max(0, currentIndex - 1);
    if (prevIndex >= 0 && prevIndex < chapters.length) {
      handleJumpToChapter(chapters[prevIndex]);
    }
  }, [chapters, activeChapter, handleJumpToChapter]);

  // Target WPM and Live Speaking Pace Calculation
  const liveWpm = useMemo(() => {
    if (settings.guidanceMode === 'tracking') {
      if (elapsedSeconds >= 4 && currentWordIndex > 0) {
        return Math.round((currentWordIndex / elapsedSeconds) * 60);
      }
      return settings.trackingTargetWpm || 130;
    }
    return speedToWpm(activeSpeed);
  }, [settings.guidanceMode, elapsedSeconds, currentWordIndex, settings.trackingTargetWpm, activeSpeed]);

  // Estimated speech/scroll duration based on text words and active speed
  const estimatedSeconds = useMemo(() => {
    const text = script?.content ? script.content.trim() : '';
    if (!text) return 0;
    const wordsCount = text.split(/\s+/).filter(Boolean).length;
    const currentWpm = settings.guidanceMode === 'tracking' ? (settings.trackingTargetWpm || 130) : speedToWpm(activeSpeed);
    return Math.round((wordsCount / currentWpm) * 60);
  }, [script?.content, settings.guidanceMode, settings.trackingTargetWpm, activeSpeed]);

  const dynamicRemainingSeconds = useMemo(() => {
    if (settings.guidanceMode === 'tracking') {
      const remainingWords = Math.max(0, words.length - currentWordIndex);
      const pace = liveWpm > 30 ? liveWpm : (settings.trackingTargetWpm || 130);
      return Math.round((remainingWords / pace) * 60);
    }
    return Math.max(0, Math.round(estimatedSeconds * (1 - (scrollProgress / 100))));
  }, [settings.guidanceMode, words.length, currentWordIndex, liveWpm, settings.trackingTargetWpm, estimatedSeconds, scrollProgress]);

  // Director Cue Sender
  const showDirectorCue = useCallback((message: string) => {
    setDirectorCue(message);
    if (cueTimeoutRef.current) clearTimeout(cueTimeoutRef.current);
    cueTimeoutRef.current = window.setTimeout(() => {
      setDirectorCue(null);
    }, 6000);
  }, []);

  const effectiveProgress = settings.guidanceMode === 'tracking' ? speechProgress : scrollProgress;

  const handleResetAll = useCallback(() => {
    resetToTop();
    resetSpeech();
    setElapsedSeconds(0);
  }, [resetToTop, resetSpeech]);

  const handleReturn = useCallback(() => {
    onReturnToEditor(elapsedSeconds);
  }, [onReturnToEditor, elapsedSeconds]);

  // In Word Tracking mode: smooth scroll active word into eyeline
  useEffect(() => {
    if (settings.guidanceMode === 'tracking' && activeWordSpanRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeEl = activeWordSpanRef.current;

      const containerHeight = container.clientHeight;
      const targetEyeOffset = (containerHeight * (settings.eyelinePosition / 100));
      const elTopRelativeToContainer = activeEl.offsetTop - container.offsetTop;

      container.scrollTo({
        top: Math.max(0, elTopRelativeToContainer - targetEyeOffset),
        behavior: 'smooth',
      });
    }
  }, [currentWordIndex, settings.guidanceMode, settings.eyelinePosition, containerRef]);

  // Keep HUD visible for 3 seconds after mouse movement
  const resetIdleTimer = useCallback(() => {
    setHudVisible(true);
    if (idleTimeoutRef.current !== null) {
      window.clearTimeout(idleTimeoutRef.current);
    }
    idleTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setHudVisible(false);
      }
    }, 2800);
  }, [isPlaying]);

  useEffect(() => {
    const handleMouseMove = () => resetIdleTimer();
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (idleTimeoutRef.current !== null) {
        window.clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [resetIdleTimer]);

  useEffect(() => {
    if (!isPlaying) {
      setHudVisible(true);
    }
  }, [isPlaying]);

  // Toggle Mute
  const handleToggleMute = useCallback(() => {
    onUpdateSettings((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  }, [onUpdateSettings]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Let Rust global shortcuts exclusively handle all Alt key combinations
      if (e.altKey) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          resetIdleTimer();
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (settings.guidanceMode === 'voice-activated') {
            onUpdateSettings((prev) => {
              const next = Math.min(50, (prev.voiceSpeed ?? 18) + 1);
              return { ...prev, voiceSpeed: next, speed: next };
            });
          } else if (settings.guidanceMode === 'classic') {
            onUpdateSettings((prev) => {
              const next = Math.min(50, (prev.classicSpeed ?? 18) + 1);
              return { ...prev, classicSpeed: next, speed: next };
            });
          }
          resetIdleTimer();
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (settings.guidanceMode === 'voice-activated') {
            onUpdateSettings((prev) => {
              const next = Math.max(1, (prev.voiceSpeed ?? 18) - 1);
              return { ...prev, voiceSpeed: next, speed: next };
            });
          } else if (settings.guidanceMode === 'classic') {
            onUpdateSettings((prev) => {
              const next = Math.max(1, (prev.classicSpeed ?? 18) - 1);
              return { ...prev, classicSpeed: next, speed: next };
            });
          }
          resetIdleTimer();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onUpdateSettings((prev) => ({
            ...prev,
            fontSize: Math.min(110, prev.fontSize + 4),
          }));
          resetIdleTimer();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onUpdateSettings((prev) => ({
            ...prev,
            fontSize: Math.max(24, prev.fontSize - 4),
          }));
          resetIdleTimer();
          break;
        case 'Home':
          e.preventDefault();
          handleResetAll();
          resetIdleTimer();
          break;
        case 'KeyG':
          e.preventDefault();
          onUpdateSettings((prev) => ({
            ...prev,
            hideFromScreenCapture: !prev.hideFromScreenCapture,
          }));
          resetIdleTimer();
          break;
        case 'KeyC':
          if (e.altKey) break;
          e.preventDefault();
          setIsChaptersOpen((prev) => !prev);
          resetIdleTimer();
          break;
        case 'KeyD':
          e.preventDefault();
          setIsDirectorOpen((prev) => !prev);
          resetIdleTimer();
          break;
        case 'PageDown':
        case 'BracketRight':
          e.preventDefault();
          handleNextChapter();
          resetIdleTimer();
          break;
        case 'PageUp':
        case 'BracketLeft':
          e.preventDefault();
          handlePrevChapter();
          resetIdleTimer();
          break;
        case 'Escape':
          e.preventDefault();
          handleReturn();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlay,
    onUpdateSettings,
    handleResetAll,
    handleReturn,
    resetIdleTimer,
    handleNextChapter,
    handlePrevChapter,
    settings.guidanceMode,
  ]);

  const palette = HIGHLIGHT_PALETTE[settings.highlightColor] || HIGHLIGHT_PALETTE.yellow;

  // Mirror transform calculation
  const transformStyle = {
    transform: `${settings.mirrorH ? 'scaleX(-1)' : ''} ${settings.mirrorV ? 'scaleY(-1)' : ''}`.trim() || 'none',
  };

  const fontFamilyClass =
    settings.fontFamily === 'serif'
      ? 'font-serif'
      : settings.fontFamily === 'mono'
      ? 'font-mono'
      : 'font-sans';

  return (
    <>
      <IslandPrompter
        words={words}
        currentWordIndex={currentWordIndex}
        isPlaying={isPlaying}
        isSpeaking={isSpeaking}
        isMicActive={isMicActive}
        isModelLoading={isModelLoading}
        isModelReady={isModelReady}
        frequencyData={frequencyData}
        settings={settings}
        onTogglePlay={togglePlay}
        onToggleMute={handleToggleMute}
        onJumpToWord={jumpToWord}
        onClose={handleReturn}
        onUpdateSettings={(newVals) => onUpdateSettings((prev) => ({ ...prev, ...newVals }))}
        elapsedSeconds={elapsedSeconds}
        currentChapterTitle={activeChapter?.title}
        directorMessage={directorCue}
        onNextChapter={handleNextChapter}
        onPrevChapter={handlePrevChapter}
      />
      <ChaptersDrawer
        isOpen={isChaptersOpen}
        onClose={() => setIsChaptersOpen(false)}
        chapters={chapters}
        activeChapterId={activeChapter?.id}
        onSelectChapter={handleJumpToChapter}
      />
      <DirectorConsole
        isOpen={isDirectorOpen}
        onClose={() => setIsDirectorOpen(false)}
        onSendCue={showDirectorCue}
      />
    </>
  );
};
