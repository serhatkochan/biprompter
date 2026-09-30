import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Play,
  Sparkles,
  Trash2,
  Sliders,
  Clock,
  Type,
  Gauge,
  Timer,
  CheckCircle2,
  Mic,
  MicOff,
  Volume2,
  Tv,
  Radio,
  Monitor,
  Palette,
  Globe,
  EyeOff,
  Crosshair,
  Download,
  ChevronDown,
  Check,
  MousePointerClick,
  Zap,
} from 'lucide-react';
import type {
  ScriptData,
  ScriptSection,
  PrompterSettings,
  TextAlignment,
  GuidanceMode,
  DisplayMode,
  SpeechLanguage,
  HighlightColor,
  AppLanguage,
} from '../types/prompter';
import {
  DEMO_SCRIPT,
  HIGHLIGHT_PALETTE,
  speedToWpm,
  wpmToSpeed,
  getWpmTempoLabel,
  getActiveSpeed,
  formatDuration,
} from '../types/prompter';
import { useAudioVisualizer } from '../hooks/useAudioVisualizer';
import { AudioWaveform } from './AudioWaveform';
import { getTranslations } from '../i18n/translations';
import { APP_LANGUAGES, SPEECH_MODELS } from '../utils/modelCatalog';
import { listDownloadedModelIds } from '../utils/modelStorage';
import { ModelDownloadModal } from './ModelDownloadModal';
import { SidebarLibraryTree } from './SidebarLibraryTree';

interface EditorViewProps {
  script: ScriptData;
  activeSection?: ScriptSection;
  onUpdateScript: (updater: (prev: ScriptData) => ScriptData) => void;
  onUpdateActiveSectionTitle?: (title: string) => void;
  onUpdateActiveSectionContent: (content: string) => void;
  settings: PrompterSettings;
  onUpdateSettings: (updater: (prev: PrompterSettings) => PrompterSettings) => void;
  onLaunchPrompter?: () => void;
  lastElapsedSeconds?: number;
  scripts?: ScriptData[];
  onSelectScript?: (script: ScriptData) => void;
  onSelectSection?: (scriptId: string, sectionId: string) => void;
  onAddSection?: (scriptId: string) => void;
  onDeleteSection?: (scriptId: string, sectionId: string) => void;
  onRenameSection?: (scriptId: string, sectionId: string, newTitle: string) => void;
  onDuplicateSection?: (scriptId: string, sectionId: string) => void;
  onCreateNewScript?: () => void;
  onDuplicateScript?: (id: string) => void;
  onDeleteScript?: (id: string) => void;
  onRenameScript?: (id: string, newTitle: string) => void;
  onImportScript?: (imported: ScriptData) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const EditorView: React.FC<EditorViewProps> = ({
  script,
  activeSection,
  onUpdateScript,
  onUpdateActiveSectionTitle,
  onUpdateActiveSectionContent,
  settings,
  onUpdateSettings,
  onLaunchPrompter,
  lastElapsedSeconds = 0,
  scripts = [],
  onSelectScript,
  onSelectSection,
  onAddSection,
  onDeleteSection,
  onRenameSection,
  onDuplicateSection,
  onCreateNewScript,
  onDuplicateScript,
  onDeleteScript,
  onRenameScript,
  onImportScript,
  isSidebarOpen = true,
  onToggleSidebar,
}) => {
  const t = getTranslations(settings.appLanguage || 'tr');

  const [micTestActive, setMicTestActive] = useState(false);
  const [downloadModalLanguage, setDownloadModalLanguage] = useState<SpeechLanguage | null>(null);
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isCountdownMenuOpen, setIsCountdownMenuOpen] = useState(false);
  const countdownDropdownRef = useRef<HTMLDivElement>(null);

  // Close countdown dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        countdownDropdownRef.current &&
        !countdownDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCountdownMenuOpen(false);
      }
    };
    if (isCountdownMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCountdownMenuOpen]);

  useEffect(() => {
    listDownloadedModelIds().then((ids) => {
      setDownloadedModels(new Set(ids));
    });
  }, []);

  // Audio Visualizer for mic test
  const {
    isMicActive,
    isSpeaking,
    frequencyData,
    startMic,
    stopMic,
  } = useAudioVisualizer({
    enabled: micTestActive,
    sensitivity: settings.micSensitivity,
  });

  const toggleMicTest = async () => {
    if (micTestActive) {
      stopMic();
      setMicTestActive(false);
    } else {
      const ok = await startMic();
      if (ok) {
        setMicTestActive(true);
      }
    }
  };

  const activeSpeed = getActiveSpeed(settings);
  const currentWpm = useMemo(() => {
    if (settings.guidanceMode === 'tracking') return settings.trackingTargetWpm || 130;
    return speedToWpm(activeSpeed);
  }, [settings.guidanceMode, activeSpeed, settings.trackingTargetWpm]);
  const tempoInfo = useMemo(() => getWpmTempoLabel(currentWpm), [currentWpm]);

  const currentVoiceWpm = useMemo(() => speedToWpm(settings.voiceSpeed ?? 18), [settings.voiceSpeed]);
  const voiceTempoInfo = useMemo(() => getWpmTempoLabel(currentVoiceWpm), [currentVoiceWpm]);

  const currentClassicWpm = useMemo(() => speedToWpm(settings.classicSpeed ?? 18), [settings.classicSpeed]);
  const classicTempoInfo = useMemo(() => getWpmTempoLabel(currentClassicWpm), [currentClassicWpm]);

  // Compute text statistics dynamically for active section (excluding cues from spoken word count)
  const stats = useMemo(() => {
    const text = activeSection && activeSection.content ? activeSection.content.trim() : '';
    if (!text) {
      return { words: 0, chars: 0, minutes: 0, seconds: 0 };
    }
    const spokenText = text.replace(/\[[^\]]+\]/g, '').trim();
    const words = spokenText.split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const totalSeconds = Math.round((words / currentWpm) * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return { words, chars, minutes, seconds };
  }, [activeSection?.content, currentWpm]);

  const hasContent = Boolean(activeSection?.content && activeSection.content.trim().length > 0);

  const loadDemoScript = () => {
    const demoSec = DEMO_SCRIPT.sections?.[0];
    onUpdateActiveSectionTitle?.(demoSec?.title || 'Giriş ve Hoşgeldiniz');
    onUpdateActiveSectionContent(demoSec?.content || DEMO_SCRIPT.content);
  };

  const clearScript = () => {
    setIsClearModalOpen(true);
  };

  const guidanceModes: { id: GuidanceMode; title: string; desc: string }[] = [
    {
      id: 'tracking',
      title: t.modeTrackingTitle,
      desc: t.modeTrackingDesc,
    },
    {
      id: 'voice-activated',
      title: t.modeVoiceTitle,
      desc: t.modeVoiceDesc,
    },
    {
      id: 'classic',
      title: t.modeClassicTitle,
      desc: t.modeClassicDesc,
    },
  ];

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex w-full h-[calc(100vh-44px)] overflow-hidden bg-[#101010] text-[#EDEDED]">
      {/* Sidebar Library & Chapter Tree */}
      {scripts && onSelectScript && (
        <SidebarLibraryTree
          scripts={scripts}
          activeScriptId={script.id}
          onSelectScript={onSelectScript}
          onSelectSection={onSelectSection}
          onAddSection={onAddSection}
          onDeleteSection={onDeleteSection}
          onRenameSection={onRenameSection}
          onDuplicateSection={onDuplicateSection}
          onCreateNewScript={onCreateNewScript || (() => {})}
          onDuplicateScript={onDuplicateScript || (() => {})}
          onDeleteScript={onDeleteScript || (() => {})}
          onRenameScript={onRenameScript || (() => {})}
          onImportScript={onImportScript || (() => {})}
          isOpen={isSidebarOpen ?? true}
          onToggleOpen={onToggleSidebar || (() => {})}
        />
      )}

      {/* Main Content Area: Cohesive Full-Height Document Studio */}
      <div className="flex-1 h-full flex flex-col bg-[#101010] overflow-hidden min-w-0">
        {/* Document Studio Controls Strip */}
        <div className="px-4 py-2 border-b border-white/[0.06] bg-[#161616] flex flex-wrap items-center justify-between gap-3 shrink-0 select-none text-xs">
          {/* Left: Mode Switcher & Inline Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
              {/* Segmented Control */}
              <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => onUpdateSettings((prev) => ({ ...prev, guidanceMode: 'tracking' }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer transition-all ${
                    settings.guidanceMode === 'tracking'
                      ? 'bg-white/[0.12] text-[#EDEDED] border border-white/[0.12] font-medium shadow-xs'
                      : 'border border-transparent text-[#8B8D98] hover:text-[#EDEDED]'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Akıllı Takip (Vosk)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings((prev) => ({ ...prev, guidanceMode: 'voice-activated' }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer transition-all ${
                    settings.guidanceMode === 'voice-activated'
                      ? 'bg-white/[0.12] text-[#EDEDED] border border-white/[0.12] font-medium shadow-xs'
                      : 'border border-transparent text-[#8B8D98] hover:text-[#EDEDED]'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Sesle Kaydırma</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings((prev) => ({ ...prev, guidanceMode: 'classic' }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer transition-all ${
                    settings.guidanceMode === 'classic'
                      ? 'bg-white/[0.12] text-[#EDEDED] border border-white/[0.12] font-medium shadow-xs'
                      : 'border border-transparent text-[#8B8D98] hover:text-[#EDEDED]'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Klasik Hız</span>
                </button>
              </div>

              {/* Contextual Settings for Tracking Mode */}
              {settings.guidanceMode === 'tracking' && (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Language selector */}
                  <select
                    value={settings.speechLanguage}
                    onChange={(e) => {
                      const selectedLang = e.target.value as SpeechLanguage;
                      const modelInfo = SPEECH_MODELS[selectedLang];
                      const isReady =
                        modelInfo?.isBundled ||
                        (modelInfo && downloadedModels.has(modelInfo.modelId));

                      if (isReady) {
                        onUpdateSettings((prev) => ({
                          ...prev,
                          speechLanguage: selectedLang,
                        }));
                      } else {
                        setDownloadModalLanguage(selectedLang);
                      }
                    }}
                    className="bg-white/[0.04] border border-white/[0.08] hover:border-white/20 rounded-md px-2 py-1 text-xs text-[#EDEDED] outline-none cursor-pointer"
                  >
                    {(Object.keys(SPEECH_MODELS) as SpeechLanguage[]).map((code) => {
                      const info = SPEECH_MODELS[code];
                      const isReady =
                        info.isBundled || downloadedModels.has(info.modelId);
                      return (
                        <option key={code} value={code} className="bg-[#161616] text-[#EDEDED]">
                          {info.nativeName} {isReady ? '✓' : `(${info.estimatedSize})`}
                        </option>
                      );
                    })}
                  </select>

                  {!SPEECH_MODELS[settings.speechLanguage]?.isBundled &&
                    !downloadedModels.has(SPEECH_MODELS[settings.speechLanguage]?.modelId) && (
                      <button
                        type="button"
                        onClick={() => setDownloadModalLanguage(settings.speechLanguage)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/20 hover:bg-amber-500/20"
                      >
                        <Download className="w-3 h-3" />
                        <span>İndir</span>
                      </button>
                    )}

                  {/* Highlight Colors */}
                  <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-md px-1.5 py-1">
                    {(Object.keys(HIGHLIGHT_PALETTE) as HighlightColor[]).map((col) => {
                      const isSelected = settings.highlightColor === col;
                      const pal = HIGHLIGHT_PALETTE[col];
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => onUpdateSettings((prev) => ({ ...prev, highlightColor: col }))}
                          className={`w-3 h-3 rounded-full ${pal.bg} border border-white/20 transition-all ${
                            isSelected ? 'ring-2 ring-white/60 scale-110' : 'opacity-70 hover:opacity-100'
                          }`}
                          title={pal.label}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Contextual Settings for Voice-Activated Mode */}
              {settings.guidanceMode === 'voice-activated' && (
                <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1">
                  <span className="text-[11px] text-[#8B8D98]">Hız:</span>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={settings.voiceSpeed ?? 18}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateSettings((prev) => ({ ...prev, voiceSpeed: val, speed: val }));
                    }}
                    className="w-24 sm:w-32 accent-[#EDEDED] bg-white/10 h-1 rounded cursor-pointer"
                  />
                  <span className="font-mono text-[11px] text-[#EDEDED] tabular-nums">
                    ~{currentVoiceWpm} WPM
                  </span>
                </div>
              )}

              {/* Contextual Settings for Classic Mode */}
              {settings.guidanceMode === 'classic' && (
                <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1">
                  <span className="text-[11px] text-[#8B8D98]">Hız:</span>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={settings.classicSpeed ?? 18}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateSettings((prev) => ({ ...prev, classicSpeed: val, speed: val }));
                    }}
                    className="w-24 sm:w-32 accent-[#EDEDED] bg-white/10 h-1 rounded cursor-pointer"
                  />
                  <span className="font-mono text-[11px] text-[#EDEDED] tabular-nums">
                    ~{currentClassicWpm} WPM
                  </span>
                </div>
              )}

              {/* Microphone Test */}
              {settings.guidanceMode !== 'classic' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMicTest}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-all ${
                      micTestActive
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-[#8B8D98] hover:text-[#EDEDED]'
                    }`}
                    title="Mikrofon Ses Seviyesi Testi"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>{micTestActive ? t.stopMic : t.testMic}</span>
                  </button>

                  {micTestActive && (
                    <AudioWaveform
                      isMicActive={isMicActive}
                      isSpeaking={isSpeaking}
                      frequencyData={frequencyData}
                      size="sm"
                    />
                  )}
                </div>
              )}
            </div>

          {/* Right: Quick Actions & Telemetry Counters */}
          <div className="flex items-center gap-3 ml-auto shrink-0">
            {/* Quick Actions: If empty, show Örnek Metin; if text exists, show Temizle */}
            <div className="flex items-center gap-1.5">
              {!hasContent ? (
                <button
                  type="button"
                  onClick={loadDemoScript}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8D98] hover:text-[#EDEDED] text-xs font-medium border border-white/[0.08] hover:border-white/20 transition-all active:scale-[0.98]"
                  title="Örnek Metin Yükle"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#8B8D98]" />
                  <span className="hidden sm:inline">{t.sampleScriptBtn}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={clearScript}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer bg-white/[0.04] hover:bg-red-500/10 text-[#8B8D98] hover:text-red-400 text-xs font-medium border border-white/[0.08] hover:border-red-500/20 transition-all active:scale-[0.98]"
                  title="Metni Temizle"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.clearScriptBtn}</span>
                </button>
              )}
            </div>

            <div className="h-3 w-px bg-white/[0.08] hidden sm:block" />

            {/* Elegant Telemetry Counters */}
            <div className="flex items-center gap-2.5 text-[11px] font-mono text-[#8B8D98]">
              <span><strong className="text-[#EDEDED] font-mono">{stats.words}</strong> kelime</span>
              <span className="text-[#323540]">•</span>
              <span><strong className="text-[#EDEDED] font-mono">{stats.chars}</strong> karakter</span>
              <span className="text-[#323540]">•</span>
              <span>~<strong className="text-[#EDEDED] font-mono">{stats.minutes}d {stats.seconds}s</strong></span>
              {lastElapsedSeconds > 0 && (
                <>
                  <span className="text-[#323540]">•</span>
                  <span className="text-emerald-400">Son: {formatDuration(lastElapsedSeconds)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Expansive Full-Height Document Writing Surface */}
        <div className="flex-1 w-full min-h-0 p-5 sm:p-8 flex flex-col overflow-hidden bg-[#101010]">
          <textarea
            ref={textareaRef}
            value={activeSection?.content || ''}
            dir={settings.appLanguage === 'ar' ? 'rtl' : 'auto'}
            onChange={(e) => onUpdateActiveSectionContent(e.target.value)}
            placeholder={t.scriptContentPlaceholder}
            className="w-full flex-1 h-full bg-transparent border-none text-base sm:text-lg text-[#EDEDED] placeholder:text-[#5C5E69] outline-none leading-relaxed resize-none font-sans overflow-y-auto"
          />
        </div>

        {/* Bottom Utility Bar */}
        <div className="h-10 border-t border-white/[0.06] bg-[#161616] px-4 sm:px-6 flex items-center justify-between shrink-0 select-none">
          {/* Left: Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Flexible Countdown Selector */}
            <div className="relative" ref={countdownDropdownRef}>
              <button
                onClick={() => setIsCountdownMenuOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border transition-all ${
                  settings.enableCountdown
                    ? 'bg-white/[0.10] border-white/20 text-[#EDEDED]'
                    : 'bg-white/[0.04] border-white/[0.08] text-[#8B8D98] hover:text-[#EDEDED]'
                }`}
                title="Geri Sayım Süresi"
              >
                <Timer className="w-3.5 h-3.5" />
                <span>
                  {settings.enableCountdown
                    ? `Geri Sayım: ${settings.countdownDuration || 3}sn`
                    : 'Geri Sayım: Kapalı'}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-[#8B8D98] transition-transform duration-150 ${
                    isCountdownMenuOpen ? 'rotate-180 text-white' : ''
                  }`}
                />
              </button>

              {/* Countdown Options Popup */}
              {isCountdownMenuOpen && (
                <div className="absolute bottom-full mb-1.5 left-0 z-30 bg-[#1C1C1E] border border-white/[0.12] rounded-lg shadow-2xl p-1 min-w-[150px] flex flex-col gap-0.5">
                  <button
                    onClick={() => {
                      onUpdateSettings((prev) => ({ ...prev, enableCountdown: false }));
                      setIsCountdownMenuOpen(false);
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors text-left cursor-pointer ${
                      !settings.enableCountdown
                        ? 'bg-white/[0.14] text-white font-medium'
                        : 'text-[#A0A0A5] hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <span>Doğrudan Başla (Kapalı)</span>
                    {!settings.enableCountdown && <Check className="w-3 h-3 text-white ml-2 shrink-0" />}
                  </button>

                  <div className="h-[1px] bg-white/[0.08] my-0.5" />

                  {[3, 5, 10, 30, 60].map((dur) => {
                    const isActive =
                      settings.enableCountdown && (settings.countdownDuration || 3) === dur;
                    return (
                      <button
                        key={dur}
                        onClick={() => {
                          onUpdateSettings((prev) => ({
                            ...prev,
                            enableCountdown: true,
                            countdownDuration: dur,
                          }));
                          setIsCountdownMenuOpen(false);
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors text-left cursor-pointer ${
                          isActive
                            ? 'bg-white/[0.14] text-white font-medium'
                            : 'text-[#A0A0A5] hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <span>{dur} saniye</span>
                        {isActive && <Check className="w-3 h-3 text-white ml-2 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ghost Mode Toggle */}
            <button
              onClick={() =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  hideFromScreenCapture: !prev.hideFromScreenCapture,
                }))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border transition-all ${
                settings.hideFromScreenCapture
                  ? 'bg-white/[0.10] border-white/20 text-[#EDEDED]'
                  : 'bg-white/[0.04] border-white/[0.08] text-[#8B8D98] hover:text-[#EDEDED]'
              }`}
              title={`${t.ghostModeTooltip} (Alt + G)`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>{t.ghostModeToggle}</span>
            </button>

            {/* Cursor Follow Toggle */}
            <button
              onClick={() =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  followCursor: !prev.followCursor,
                }))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border transition-all ${
                settings.followCursor
                  ? 'bg-white/[0.10] border-white/20 text-[#EDEDED]'
                  : 'bg-white/[0.04] border-white/[0.08] text-[#8B8D98] hover:text-[#EDEDED]'
              }`}
              title={`${t.cursorFollowTooltip} (Alt + M)`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{t.cursorFollowToggle}</span>
            </button>

            {/* Click-Through Mode (Fareyi Alta Geçir) Toggle */}
            <button
              onClick={() =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  clickThrough: !prev.clickThrough,
                }))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border transition-all ${
                settings.clickThrough
                  ? 'bg-white/[0.10] border-white/20 text-[#EDEDED]'
                  : 'bg-white/[0.04] border-white/[0.08] text-[#8B8D98] hover:text-[#EDEDED]'
              }`}
              title="Prompter açıkken tıklamaları arkadaki pencereye ilet (Alt + C)"
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>Fareyi Alta Geçir</span>
            </button>

            {/* Auto-Start (Otomatik Başlat) Toggle */}
            <button
              onClick={() =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  autoStart: prev.autoStart === false ? true : false,
                }))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border transition-all ${
                settings.autoStart !== false
                  ? 'bg-white/[0.10] border-white/20 text-[#EDEDED]'
                  : 'bg-white/[0.04] border-white/[0.08] text-[#8B8D98] hover:text-[#EDEDED]'
              }`}
              title="Prompter açıldığında otomatik başlasın mı?"
            >
              <Zap className={`w-3.5 h-3.5 ${settings.autoStart !== false ? 'text-amber-400 fill-amber-400/20' : 'text-zinc-500'}`} />
              <span>
                {settings.autoStart !== false ? 'Otomatik Başlat: Açık' : 'Otomatik Başlat: Kapalı'}
              </span>
            </button>

            {/* Microphone Mute Toggle */}
            <button
              onClick={() =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  isMuted: !prev.isMuted,
                }))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border transition-all ${
                settings.isMuted
                  ? 'bg-red-500/20 border-red-500/40 text-red-300'
                  : 'bg-white/[0.04] border-white/[0.08] text-[#8B8D98] hover:text-[#EDEDED]'
              }`}
              title={settings.isMuted ? 'Mikrofonu Aç (Alt + S)' : 'Mikrofonu Kapat (Alt + S)'}
            >
              {settings.isMuted ? (
                <MicOff className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Mic className="w-3.5 h-3.5" />
              )}
              <span>{settings.isMuted ? 'Mikrofon Kapalı' : 'Mikrofon Açık'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Model Download Modal */}
      {downloadModalLanguage && (
        <ModelDownloadModal
          language={downloadModalLanguage}
          appLanguage={settings.appLanguage || 'tr'}
          isOpen={!!downloadModalLanguage}
          onClose={() => setDownloadModalLanguage(null)}
          onSuccess={(lang) => {
            const modelInfo = SPEECH_MODELS[lang];
            if (modelInfo) {
              setDownloadedModels((prev) => new Set([...prev, modelInfo.modelId]));
            }
            onUpdateSettings((prev) => ({ ...prev, speechLanguage: lang }));
            setDownloadModalLanguage(null);
          }}
        />
      )}

      {/* Antigravity Design System Clear Confirmation Modal */}
      {isClearModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
          onClick={() => setIsClearModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-[#1E1E1E] border border-white/[0.1] rounded-xl p-5 shadow-2xl text-left flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[#EDEDED]">Metni Temizle</h3>
                <p className="text-xs text-[#8B8D98] mt-1 leading-relaxed">
                  Bu konuşma metninin tüm içeriği silinecektir. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-[#8B8D98] hover:text-[#EDEDED] cursor-pointer bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors active:scale-[0.98]"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateActiveSectionTitle?.('');
                  onUpdateActiveSectionContent('');
                  setIsClearModalOpen(false);
                }}
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-white cursor-pointer bg-red-600 hover:bg-red-500 transition-colors shadow-xs active:scale-[0.98]"
              >
                Evet, Temizle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
