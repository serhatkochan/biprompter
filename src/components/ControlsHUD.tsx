import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Minus,
  Plus,
  EyeOff,
  Maximize2,
  Minimize2,
  FileEdit,
  Keyboard,
  Mic,
  MicOff,
  X,
  Clock,
  Bookmark,
  MessageSquare,
} from 'lucide-react';
import type { PrompterSettings } from '../types/prompter';
import { speedToWpm, getActiveSpeed, formatDuration } from '../types/prompter';
import { AudioWaveform } from './AudioWaveform';
import { getTranslations } from '../i18n/translations';

interface ControlsHUDProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  settings: PrompterSettings;
  onUpdateSettings: (updater: (prev: PrompterSettings) => PrompterSettings) => void;
  onReturnToEditor: () => void;
  scrollProgress: number;
  visible: boolean;
  isMicActive?: boolean;
  isSpeaking?: boolean;
  frequencyData?: number[];
  isModelLoading?: boolean;
  isModelReady?: boolean;
  onToggleMute?: () => void;
  elapsedSeconds?: number;
  estimatedSeconds?: number;
  remainingSeconds?: number;
  liveWpm?: number;
  currentChapterTitle?: string;
  onOpenChapters?: () => void;
  onOpenDirector?: () => void;
}

export const ControlsHUD: React.FC<ControlsHUDProps> = ({
  isPlaying,
  onTogglePlay,
  onReset,
  settings,
  onUpdateSettings,
  onReturnToEditor,
  scrollProgress,
  visible,
  isMicActive = false,
  isSpeaking = false,
  frequencyData = [0, 0, 0, 0, 0],
  isModelLoading = false,
  isModelReady = false,
  onToggleMute,
  elapsedSeconds = 0,
  estimatedSeconds = 0,
  remainingSeconds = 0,
  liveWpm = 0,
  currentChapterTitle,
  onOpenChapters,
  onOpenDirector,
}) => {
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const activeSpeed = getActiveSpeed(settings);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const changeSpeed = (delta: number) => {
    if (settings.guidanceMode === 'voice-activated') {
      onUpdateSettings((prev) => {
        const next = Math.max(1, Math.min(50, (prev.voiceSpeed ?? 18) + delta));
        return { ...prev, voiceSpeed: next, speed: next };
      });
    } else {
      onUpdateSettings((prev) => {
        const next = Math.max(1, Math.min(50, (prev.classicSpeed ?? 18) + delta));
        return { ...prev, classicSpeed: next, speed: next };
      });
    }
  };

  const changeFontSize = (delta: number) => {
    onUpdateSettings((prev) => ({
      ...prev,
      fontSize: Math.max(24, Math.min(110, prev.fontSize + delta)),
    }));
  };

  const t = getTranslations(settings.appLanguage || 'tr');

  const modeBadge =
    settings.guidanceMode === 'tracking'
      ? {
          label: isModelLoading
            ? t.modelDownloading
            : isModelReady
            ? `${t.modeTrackingTitle} (Vosk)`
            : t.modeTrackingTitle,
        }
      : settings.guidanceMode === 'voice-activated'
      ? {
          label: isSpeaking
            ? `${t.modeVoiceTitle} (${t.speaking})`
            : `${t.modeVoiceTitle} (${t.silent})`,
        }
      : { label: t.modeClassicTitle };

  return (
    <div
      className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 transition-all duration-200 ${
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <div className="flex flex-col items-center gap-2 select-none">
        {/* Main Floating Console */}
        <div className="bg-[#18181B] border border-neutral-700/80 rounded-md flex items-center gap-1 sm:gap-2 px-3 py-2 text-white shadow-xl">
          {/* Return to Editor */}
          <button
            onClick={onReturnToEditor}
            title={`${t.returnToEditor} (ESC)`}
            className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <FileEdit className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-neutral-700 mx-0.5" />

          {/* Reset to Start */}
          <button
            onClick={onReset}
            title={`${t.resetToTop} (Home)`}
            className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Play / Pause - Center Minimalist Trigger */}
          <button
            onClick={onTogglePlay}
            title={t.playPauseTooltip}
            className="flex items-center justify-center w-9 h-9 rounded bg-white hover:bg-neutral-200 text-[#111111] font-bold transition-all active:scale-95"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-[#111111]" />
            ) : (
              <Play className="w-4 h-4 fill-[#111111] ml-0.5" />
            )}
          </button>

          {/* Live Elapsed & Remaining Time Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-900 border border-neutral-700 text-xs text-neutral-200 font-mono tabular-nums"
            title={`${t.elapsedTime} / ${remainingSeconds > 0 ? 'Kalan Süre' : t.estDuration}`}
          >
            <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="font-bold text-white">
              {formatDuration(elapsedSeconds)}
            </span>
            {remainingSeconds > 0 ? (
              <>
                <span className="text-neutral-600">/</span>
                <span className="text-neutral-400 text-[11px]" title="Tahmini Kalan Süre">
                  ~{formatDuration(remainingSeconds)}
                </span>
              </>
            ) : estimatedSeconds > 0 ? (
              <>
                <span className="text-neutral-600">/</span>
                <span className="text-neutral-400 text-[11px]">
                  ~{formatDuration(estimatedSeconds)}
                </span>
              </>
            ) : null}
            {liveWpm > 0 && (
              <span className="ml-1 px-1 rounded bg-neutral-800 text-neutral-300 text-[10px]" title="Canlı Okuma Hızı">
                {liveWpm} wpm
              </span>
            )}
          </div>

          {/* Mode Badge & Audio Waveform */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-900 border border-neutral-700 text-xs">
            <span className="text-[11px] text-neutral-300 hidden md:inline">
              {modeBadge.label}
            </span>

            {settings.guidanceMode !== 'classic' && (
              <AudioWaveform
                isMicActive={isMicActive}
                isSpeaking={isSpeaking}
                isMuted={settings.isMuted}
                frequencyData={frequencyData}
                size="sm"
              />
            )}
          </div>

          {/* Microphone Mute / Unmute Toggle */}
          {settings.guidanceMode !== 'classic' && onToggleMute && (
            <button
              onClick={onToggleMute}
              title={settings.isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'}
              className={`p-1.5 rounded transition-colors ${
                settings.isMuted
                  ? 'bg-[#FDEBEC] text-[#9F2F2D]'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              {settings.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[#346538]" />}
            </button>
          )}

          {/* Speed Controls (Classic and Voice-Activated) */}
          {settings.guidanceMode !== 'tracking' && (
            <div className="flex items-center bg-neutral-900 rounded px-1.5 py-0.5 border border-neutral-700">
              <button
                onClick={() => changeSpeed(-1)}
                title="Hızı Azalt (Aşağı Ok)"
                className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <div className="px-1.5 flex flex-col items-center min-w-[42px]">
                <span className="text-xs font-bold text-white font-mono leading-none tabular-nums">
                  {activeSpeed}
                </span>
                <span className="text-[9px] text-neutral-400 font-mono tracking-tight leading-none mt-0.5 tabular-nums">
                  {speedToWpm(activeSpeed)} wpm
                </span>
              </div>
              <button
                onClick={() => changeSpeed(1)}
                title="Hızı Artır (Yukarı Ok)"
                className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Font Size Controls */}
          <div className="flex items-center bg-neutral-900 rounded px-1.5 py-0.5 border border-neutral-700">
            <button
              onClick={() => changeFontSize(-4)}
              title="Yazıyı Küçült (Sol Ok)"
              className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <div className="px-1.5 flex items-center gap-0.5 min-w-[36px] justify-center">
              <span className="text-xs font-bold text-white font-mono tabular-nums">
                {settings.fontSize}
              </span>
              <span className="text-[9px] text-neutral-500 font-mono">px</span>
            </div>
            <button
              onClick={() => changeFontSize(4)}
              title="Yazıyı Büyüt (Sağ Ok)"
              className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="h-4 w-px bg-neutral-700 mx-0.5" />

          {/* Chapter Drawer Button */}
          {onOpenChapters && (
            <button
              onClick={onOpenChapters}
              title={`Bölümler (C)${currentChapterTitle ? ` • ${currentChapterTitle}` : ''}`}
              className="flex items-center gap-1 p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <Bookmark className="w-4 h-4" />
              {currentChapterTitle && (
                <span className="max-w-[80px] truncate text-[11px] text-neutral-300 hidden xl:inline font-mono">
                  {currentChapterTitle}
                </span>
              )}
            </button>
          )}

          {/* Director Console Button */}
          {onOpenDirector && (
            <button
              onClick={onOpenDirector}
              title="Yönetmen Konsolu (D)"
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}

          <div className="h-4 w-px bg-neutral-700 mx-0.5" />

          {/* Horizontal Mirror */}
          <button
            onClick={() => onUpdateSettings((prev) => ({ ...prev, mirrorH: !prev.mirrorH }))}
            title="Yatay Ayna Modu"
            className={`p-1.5 rounded transition-colors ${
              settings.mirrorH
                ? 'bg-white text-[#111111]'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>

          {/* Vertical Mirror */}
          <button
            onClick={() => onUpdateSettings((prev) => ({ ...prev, mirrorV: !prev.mirrorV }))}
            title="Dikey Ayna Modu"
            className={`p-1.5 rounded transition-colors ${
              settings.mirrorV
                ? 'bg-white text-[#111111]'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <FlipVertical className="w-4 h-4" />
          </button>


          {/* Ghost Mode Toggle */}
          <button
            onClick={() => onUpdateSettings((prev) => ({ ...prev, hideFromScreenCapture: !prev.hideFromScreenCapture }))}
            title={t.ghostModeTooltip}
            className={`p-1.5 rounded transition-colors ${
              settings.hideFromScreenCapture
                ? 'bg-white text-[#111111]'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <EyeOff className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? t.fullscreenExit : t.fullscreenEnter}
            className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Keyboard Shortcuts Help */}
          <button
            onClick={() => setShowKeyboardHelp((prev) => !prev)}
            title={t.shortcutHints}
            className={`p-1.5 rounded transition-colors ${
              showKeyboardHelp
                ? 'bg-white text-[#111111]'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>

        {/* Keyboard Shortcuts Popover */}
        {showKeyboardHelp && (
          <div className="w-80 p-4 rounded-md bg-[#18181B] border border-neutral-700 text-xs shadow-2xl animate-in fade-in duration-100">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-700">
              <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
                <Keyboard className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t.shortcutHints}</span>
              </span>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">{t.playPauseTooltip}:</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px]">Space</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">{t.shortcutSpeed}:</span>
                <span className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px]">▲</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px]">▼</kbd>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">{t.shortcutFontSize}:</span>
                <span className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px]">◄</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px]">►</kbd>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Sonraki / Önceki Bölüm:</span>
                <span className="flex gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px]">PgDn / ]</kbd>
                  <kbd className="px-1 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px]">PgUp / [</kbd>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Bölümler Çekmecesi:</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px]">C</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Yönetmen Konsolu:</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px]">D</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">{t.shortcutReset}:</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px]">Home</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">{t.shortcutGhost}:</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px]">G</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">{t.shortcutExit}:</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px]">ESC</kbd>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
