import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Plus,
  FileText,
  Upload,
  Sparkles,
  ArrowRight,
  Clock,
  Mic,
  Monitor,
  Check,
  Zap,
  HelpCircle,
  X,
  Layers,
} from 'lucide-react';
import type { ScriptData, PrompterSettings, AppLanguage } from '../types/prompter';
import { DEMO_SCRIPT, speedToWpm, formatDuration } from '../types/prompter';
import { formatTimeAgo } from '../utils/scriptStorage';

interface WelcomeScreenProps {
  isOpen: boolean;
  onClose: () => void;
  activeScript: ScriptData;
  scripts: ScriptData[];
  onSelectScript: (script: ScriptData) => void;
  onCreateNewScript: () => void;
  onImportScript: (imported: ScriptData) => void;
  onLaunchPrompter: () => void;
  settings: PrompterSettings;
  onUpdateSettings: React.Dispatch<React.SetStateAction<PrompterSettings>>;
  appLanguage?: AppLanguage;
  isInitialLaunch?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  isOpen,
  onClose,
  activeScript,
  scripts,
  onSelectScript,
  onCreateNewScript,
  onImportScript,
  onLaunchPrompter,
  settings,
  onUpdateSettings,
  appLanguage = 'tr',
  isInitialLaunch = false,
}) => {
  // Splash phase: if cold start, show animated splash briefly (1.1s), then transition to hub
  const [isSplashing, setIsSplashing] = useState<boolean>(isInitialLaunch);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isInitialLaunch) {
      const timer = setTimeout(() => {
        setIsSplashing(false);
      }, 1100);
      return () => clearTimeout(timer);
    } else {
      setIsSplashing(false);
    }
  }, [isInitialLaunch]);

  // Keyboard navigation: Enter to continue, Esc to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !isSplashing) {
        // If not in an input, Enter resumes active script
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSplashing, onClose]);

  // Derived stats for active script
  const scriptStats = useMemo(() => {
    const fullContent = (activeScript.sections || [])
      .map((s) => s.content || '')
      .join(' ')
      .trim();
    const words = fullContent ? fullContent.split(/\s+/).filter(Boolean).length : 0;
    const wpm = speedToWpm(settings.speed || 18);
    const estimatedSecs = words > 0 ? Math.round((words / wpm) * 60) : 0;
    const snippet = fullContent ? fullContent.slice(0, 110).trim() + (fullContent.length > 110 ? '...' : '') : 'Henüz metin eklenmedi.';
    return { words, estimatedSecs, snippet };
  }, [activeScript, settings.speed]);

  // Recent other scripts (excluding active one if possible)
  const recentScripts = useMemo(() => {
    return scripts
      .filter((s) => s.id !== activeScript.id)
      .slice(0, 3);
  }, [scripts, activeScript.id]);

  // File import handler (.txt, .md)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const secId = `sec-${Date.now()}`;

      // Split into sections if markdown headers are found (## or #)
      const lines = text.split('\n');
      const sections: Array<{ id: string; title: string; content: string; updatedAt: number }> = [];
      let curTitle = 'Giriş';
      let curContent: string[] = [];

      for (const line of lines) {
        if (line.startsWith('#')) {
          if (curContent.length > 0 || sections.length > 0) {
            sections.push({
              id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              title: curTitle,
              content: curContent.join('\n').trim(),
              updatedAt: Date.now(),
            });
            curContent = [];
          }
          curTitle = line.replace(/^#+\s*/, '').trim() || 'Bölüm';
        } else {
          curContent.push(line);
        }
      }

      if (curContent.length > 0 || sections.length === 0) {
        sections.push({
          id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title: curTitle,
          content: curContent.join('\n').trim(),
          updatedAt: Date.now(),
        });
      }

      const importedScript: ScriptData = {
        id: `script-${Date.now()}`,
        title: baseName || 'İçe Aktarılan Metin',
        sections: sections.length > 0 ? sections : [{ id: secId, title: 'Bölüm 1', content: text, updatedAt: Date.now() }],
        activeSectionId: sections[0]?.id || secId,
        content: text,
        updatedAt: Date.now(),
      };

      onImportScript(importedScript);
      onClose();
    };

    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelectAndClose = (script: ScriptData) => {
    onSelectScript(script);
    onClose();
  };

  const handleCreateAndClose = () => {
    onCreateNewScript();
    onClose();
  };

  const handleDemoAndClose = () => {
    onSelectScript(DEMO_SCRIPT);
    onClose();
  };

  const handleDirectPrompter = () => {
    onClose();
    setTimeout(() => {
      onLaunchPrompter();
    }, 120);
  };

  const toggleShowOnStartup = () => {
    onUpdateSettings((prev) => ({
      ...prev,
      showWelcomeOnStartup: !(prev.showWelcomeOnStartup ?? true),
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#101010]/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* SPLASH VIEW (Cold Start Animation) */}
      {isSplashing ? (
        <div
          onClick={() => setIsSplashing(false)}
          className="flex flex-col items-center justify-center text-center cursor-pointer max-w-sm w-full space-y-6"
        >
          {/* Animated Logo Mark */}
          <div className="relative group">
            <div className="absolute -inset-3 bg-white/10 rounded-2xl blur-lg transition duration-700 animate-pulse" />
            <div className="relative w-16 h-16 bg-white text-black font-extrabold rounded-2xl flex items-center justify-center text-2xl shadow-2xl border border-white/20">
              Bi
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight text-white font-sans">
              Biprompter
            </h1>
            <p className="text-xs text-[#8B8D98]">
              Yapay Zeka Destekli Sesli Teleprompter
            </p>
          </div>

          {/* Soundwave Bars Indicator */}
          <div className="flex items-center justify-center gap-1.5 h-6">
            <span className="w-1 h-3 bg-white/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1 h-5 bg-white/80 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1 h-3 bg-white/40 rounded-full animate-bounce" />
          </div>

          <div className="text-[11px] font-mono text-[#8B8D98] bg-[#161616] px-3 py-1 rounded-full border border-white/[0.06]">
            Çevrimdışı ses modeli & kütüphane hazırlanıyor...
          </div>
        </div>
      ) : (
        /* WELCOME HUB VIEW (Main Opening Canvas) */
        <div className="relative w-full max-w-3xl bg-[#161616] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Top Bar / Brand Strip */}
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between bg-[#191919]/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white text-black font-extrabold rounded-lg flex items-center justify-center text-base shadow-sm">
                Bi
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white tracking-tight">
                    Biprompter
                  </h2>
                  <span className="text-[10px] font-mono text-[#8B8D98] bg-white/[0.06] px-1.5 py-0.5 rounded">
                    v1.0.0
                  </span>
                </div>
                <p className="text-xs text-[#8B8D98]">
                  Profesyonel Masaüstü Teleprompter Stüdyosu
                </p>
              </div>
            </div>

            {/* Quick Badges & Close Button */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] text-[#8B8D98] text-[11px] px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>100% Çevrimdışı & Yerel</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#8B8D98] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                title="Stüdyoya Dön (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Body (Scrollable) */}
          <div className="p-6 space-y-6 overflow-y-auto">
            {/* HERO CARD: Kaldığın Yerden Devam Et (Resume Active Script) */}
            <div className="bg-[#1D1D1D] hover:bg-[#202020] border border-white/[0.08] hover:border-white/20 rounded-xl p-5 transition-all duration-200">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.08] text-white flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider block">
                      Kaldığın Yerden Devam Et
                    </span>
                    <h3 className="text-base font-semibold text-white tracking-tight">
                      {activeScript.title || 'İsimsiz Konuşma'}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={onClose}
                    className="flex items-center gap-1.5 bg-white text-black font-semibold px-4 py-2 rounded-lg text-xs hover:bg-neutral-200 transition-colors cursor-pointer shadow-sm active:scale-[0.98]"
                  >
                    <span>Stüdyoyu Aç</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleDirectPrompter}
                    className="flex items-center gap-1.5 bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.12] px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer active:scale-[0.98]"
                    title="Doğrudan Dynamic Island Prompter'ı Başlat"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
                    <span>Hemen Oku</span>
                  </button>
                </div>
              </div>

              {/* Text Snippet */}
              <p className="text-xs text-[#8B8D98] leading-relaxed line-clamp-2 bg-[#171717] p-2.5 rounded-md border border-white/[0.04]">
                {scriptStats.snippet}
              </p>

              {/* Script Metadata Strip */}
              <div className="flex items-center gap-4 mt-3 text-[11px] text-[#8B8D98]">
                <div className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-[#8B8D98]" />
                  <span>{scriptStats.words} kelime</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#8B8D98]" />
                  <span>Tahmini {formatDuration(scriptStats.estimatedSecs)}</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-[#8B8D98]" />
                  <span>{activeScript.sections?.length || 1} bölüm</span>
                </div>
              </div>
            </div>

            {/* QUICK ACTIONS GRID: Yeni Metin, İçe Aktar, Demo */}
            <div>
              <h4 className="text-xs font-semibold text-[#8B8D98] uppercase tracking-wider mb-2.5">
                Hızlı İşlemler
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Yeni Konuşma Metni */}
                <button
                  onClick={handleCreateAndClose}
                  className="flex flex-col items-start p-4 rounded-xl bg-[#1A1A1A] hover:bg-[#202020] border border-white/[0.06] hover:border-white/20 text-left transition-all duration-150 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] group-hover:bg-white/[0.12] text-white flex items-center justify-center mb-2.5 transition-colors">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                    Yeni Konuşma Metni
                  </span>
                  <span className="text-[11px] text-[#8B8D98] leading-snug">
                    Sıfırdan boş bir metin ve bölümler oluşturun.
                  </span>
                </button>

                {/* 2. Metin İçe Aktar (.txt / .md) */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-start p-4 rounded-xl bg-[#1A1A1A] hover:bg-[#202020] border border-white/[0.06] hover:border-white/20 text-left transition-all duration-150 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] group-hover:bg-white/[0.12] text-white flex items-center justify-center mb-2.5 transition-colors">
                    <Upload className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-xs font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">
                    Metin İçe Aktar
                  </span>
                  <span className="text-[11px] text-[#8B8D98] leading-snug">
                    .txt veya .md dosyasını otomatik bölümlere ayırın.
                  </span>
                </button>

                {/* 3. Demo & Örnek Rehber */}
                <button
                  onClick={handleDemoAndClose}
                  className="flex flex-col items-start p-4 rounded-xl bg-[#1A1A1A] hover:bg-[#202020] border border-white/[0.06] hover:border-white/20 text-left transition-all duration-150 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] group-hover:bg-white/[0.12] text-white flex items-center justify-center mb-2.5 transition-colors">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-white mb-1 group-hover:text-amber-400 transition-colors">
                    Örnek Rehber Metin
                  </span>
                  <span className="text-[11px] text-[#8B8D98] leading-snug">
                    Biprompter konuşma ve ipucu şablonunu açın.
                  </span>
                </button>
              </div>
            </div>

            {/* RECENT SCRIPTS (Son Metinler) */}
            {recentScripts.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[#8B8D98] uppercase tracking-wider mb-2.5">
                  Diğer Son Metinler
                </h4>
                <div className="space-y-1.5">
                  {recentScripts.map((script) => (
                    <div
                      key={script.id}
                      onClick={() => handleSelectAndClose(script)}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#1A1A1A] hover:bg-[#222222] border border-white/[0.04] hover:border-white/10 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-[#8B8D98] group-hover:text-white shrink-0" />
                        <span className="text-xs text-[#EDEDED] group-hover:text-white font-medium truncate">
                          {script.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#8B8D98] shrink-0">
                        <span>{script.sections?.length || 1} bölüm</span>
                        <span>•</span>
                        <span>{formatTimeAgo(script.updatedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SHORTCUTS & PRO TIPS */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex flex-wrap items-center justify-between gap-3 text-xs text-[#8B8D98]">
              <div className="flex items-center gap-2">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                <span><strong className="text-white">Ses Takibi:</strong> Konuştukça otomatik kayar.</span>
              </div>
              <div className="flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5 text-blue-400" />
                <span><strong className="text-white">Dynamic Island:</strong> Minimalist çentik modu.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-400">⌨️</span>
                <span><strong className="text-white">Boşluk:</strong> Duraklat/Devam • <strong className="text-white">ESC:</strong> Stüdyo</span>
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="px-6 py-3.5 border-t border-white/[0.06] bg-[#141414] flex items-center justify-between">
            {/* Show on startup toggle */}
            <label className="flex items-center gap-2 text-xs text-[#8B8D98] cursor-pointer hover:text-[#EDEDED] transition-colors select-none">
              <input
                type="checkbox"
                checked={settings.showWelcomeOnStartup ?? true}
                onChange={toggleShowOnStartup}
                className="w-3.5 h-3.5 rounded bg-[#202020] border-white/20 text-white accent-white cursor-pointer"
              />
              <span>Uygulama açılırken bu ekranı göster</span>
            </label>

            {/* Enter Studio CTA */}
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.12] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer active:scale-[0.98]"
            >
              <span>Stüdyoya Geç</span>
              <span className="text-[10px] text-[#8B8D98] font-mono ml-0.5">[ESC]</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
