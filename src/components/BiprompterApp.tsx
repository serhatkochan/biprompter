import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Header } from './Header';
import { EditorView } from './EditorView';
import { PrompterView } from './PrompterView';
import { CountdownOverlay } from './CountdownOverlay';
import { WelcomeScreen } from './WelcomeScreen';
import { DEMO_SCRIPT, DEFAULT_SETTINGS } from '../types/prompter';
import type { ScriptData, ScriptSection, PrompterSettings } from '../types/prompter';
import { loadAllScripts, getActiveScriptId, ensureScriptSections } from '../utils/scriptStorage';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getTranslations } from '../i18n/translations';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Biprompter ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-[#101010] text-[#EDEDED] flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 bg-white text-black font-bold rounded-lg flex items-center justify-center text-xl mb-4">
            Bi
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Biprompter Yüklenirken Bir Hata Oluştu</h2>
          <p className="text-xs text-[#F87171] max-w-md mb-6 font-mono bg-[#1E1E1E] p-3 rounded-md border border-[#F87171]/20">
            {this.state.error?.message || 'Bilinmeyen hata'}
          </p>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="px-4 py-2 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md transition-colors"
          >
            Ayarları Sıfırla ve Yeniden Başlat
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const BiprompterApp: React.FC = () => {
  return (
    <ErrorBoundary>
      <BiprompterAppContent />
    </ErrorBoundary>
  );
};

const BiprompterAppContent: React.FC = () => {
  const [mode, setMode] = useState<'editor' | 'prompter'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'prompter') return 'prompter';
    }
    return 'editor';
  });
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [lastElapsedSeconds, setLastElapsedSeconds] = useState<number>(0);

  // Welcome Screen & Startup Experience
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'prompter') return false;
      try {
        const savedSettings = localStorage.getItem('biprompter_settings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          if (parsed.showWelcomeOnStartup === false) return false;
        }
      } catch (e) {
        // ignore
      }
    }
    return true;
  });
  const [isInitialLaunch, setIsInitialLaunch] = useState<boolean>(true);

  // Single Source of Truth for Multi-Script Storage
  const [scripts, setScripts] = useLocalStorage<ScriptData[]>(
    'biprompter_scripts_library_v1',
    loadAllScripts()
  );
  const [activeScriptId, setActiveScriptId] = useLocalStorage<string>(
    'biprompter_active_script_id',
    getActiveScriptId()
  );
  const [isSidebarOpen, setIsSidebarOpen] = useLocalStorage<boolean>(
    'biprompter_sidebar_open',
    true
  );

  const [settings, setSettings] = useLocalStorage<PrompterSettings>(
    'biprompter_settings',
    DEFAULT_SETTINGS
  );

  // Derive active script cleanly and ensure sections exist
  const activeScript = useMemo(() => {
    const found = scripts.find((s) => s.id === activeScriptId) || scripts[0] || DEMO_SCRIPT;
    return ensureScriptSections(found);
  }, [scripts, activeScriptId]);

  // Derive active section for editor
  const activeSection = useMemo(() => {
    const sections = activeScript.sections || [];
    return (
      sections.find((sec) => sec.id === activeScript.activeSectionId) ||
      sections[0] || {
        id: `sec-${Date.now()}`,
        title: '',
        content: '',
      }
    );
  }, [activeScript]);

  // Synchronize active script updates directly with scripts list
  const handleUpdateActiveScript = useCallback(
    (updater: React.SetStateAction<ScriptData>) => {
      setScripts((prevScripts) => {
        const current =
          prevScripts.find((s) => s.id === activeScriptId) || prevScripts[0] || DEMO_SCRIPT;
        const next = typeof updater === 'function' ? updater(current) : updater;
        return prevScripts.map((s) => (s.id === current.id ? { ...next, id: s.id, updatedAt: Date.now() } : s));
      });
    },
    [activeScriptId, setScripts]
  );

  // Script Actions
  const handleSelectScript = useCallback(
    (selected: ScriptData) => {
      setActiveScriptId(selected.id);
    },
    [setActiveScriptId]
  );

  const handleSelectSection = useCallback(
    (scriptId: string, sectionId: string) => {
      setActiveScriptId(scriptId);
      setScripts((prev) =>
        prev.map((s) => (s.id === scriptId ? { ...s, activeSectionId: sectionId } : s))
      );
    },
    [setActiveScriptId, setScripts]
  );

  const handleAddSection = useCallback(
    (scriptId: string) => {
      const newSecId = `sec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newSection: ScriptSection = {
        id: newSecId,
        title: '',
        content: '',
        updatedAt: Date.now(),
      };

      setActiveScriptId(scriptId);
      setScripts((prev) =>
        prev.map((s) => {
          if (s.id !== scriptId) return s;
          const currentSections = s.sections || [];
          const updatedSections = [...currentSections, newSection];
          return {
            ...s,
            sections: updatedSections,
            activeSectionId: newSecId,
            content: updatedSections.map((sec) => sec.content).join('\n\n'),
            updatedAt: Date.now(),
          };
        })
      );
    },
    [setActiveScriptId, setScripts]
  );

  const handleDeleteSection = useCallback(
    (scriptId: string, sectionId: string) => {
      setScripts((prev) =>
        prev.map((s) => {
          if (s.id !== scriptId) return s;
          const currentSections = s.sections || [];
          if (currentSections.length <= 1) {
            const resetSec: ScriptSection = {
              id: currentSections[0]?.id || `sec-${Date.now()}`,
              title: '',
              content: '',
              updatedAt: Date.now(),
            };
            return {
              ...s,
              sections: [resetSec],
              activeSectionId: resetSec.id,
              content: '',
              updatedAt: Date.now(),
            };
          }
          const filtered = currentSections.filter((sec) => sec.id !== sectionId);
          const nextActiveId =
            s.activeSectionId === sectionId ? filtered[0]?.id : s.activeSectionId;
          return {
            ...s,
            sections: filtered,
            activeSectionId: nextActiveId,
            content: filtered.map((sec) => sec.content).join('\n\n'),
            updatedAt: Date.now(),
          };
        })
      );
    },
    [setScripts]
  );

  const handleRenameSection = useCallback(
    (scriptId: string, sectionId: string, newTitle: string) => {
      setScripts((prev) =>
        prev.map((s) => {
          if (s.id !== scriptId) return s;
          const currentSections = s.sections || [];
          const updatedSections = currentSections.map((sec) =>
            sec.id === sectionId ? { ...sec, title: newTitle, updatedAt: Date.now() } : sec
          );
          return {
            ...s,
            sections: updatedSections,
            updatedAt: Date.now(),
          };
        })
      );
    },
    [setScripts]
  );

  const handleDuplicateSection = useCallback(
    (scriptId: string, sectionId: string) => {
      setScripts((prev) =>
        prev.map((s) => {
          if (s.id !== scriptId) return s;
          const currentSections = s.sections || [];
          const targetIndex = currentSections.findIndex((sec) => sec.id === sectionId);
          if (targetIndex === -1) return s;
          const target = currentSections[targetIndex];
          const newSecId = `sec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const duplicatedSection: ScriptSection = {
            ...target,
            id: newSecId,
            title: target.title ? `${target.title} (Kopya)` : 'Metin Başlığı... (Kopya)',
            updatedAt: Date.now(),
          };
          const updatedSections = [
            ...currentSections.slice(0, targetIndex + 1),
            duplicatedSection,
            ...currentSections.slice(targetIndex + 1),
          ];
          return {
            ...s,
            sections: updatedSections,
            activeSectionId: newSecId,
            content: updatedSections.map((sec) => sec.content).join('\n\n'),
            updatedAt: Date.now(),
          };
        })
      );
      setActiveScriptId(scriptId);
    },
    [setScripts, setActiveScriptId]
  );

  const handleUpdateActiveSectionTitle = useCallback(
    (newTitle: string) => {
      setScripts((prev) =>
        prev.map((s) => {
          if (s.id !== activeScript.id) return s;
          const currentSections = s.sections || [];
          const activeSecId = s.activeSectionId || currentSections[0]?.id;
          const updatedSections = currentSections.map((sec) =>
            sec.id === activeSecId ? { ...sec, title: newTitle, updatedAt: Date.now() } : sec
          );
          return {
            ...s,
            sections: updatedSections,
            updatedAt: Date.now(),
          };
        })
      );
    },
    [activeScript.id, setScripts]
  );

  const handleUpdateActiveSectionContent = useCallback(
    (newContent: string) => {
      setScripts((prev) =>
        prev.map((s) => {
          if (s.id !== activeScript.id) return s;
          const currentSections = s.sections || [];
          const activeSecId = s.activeSectionId || currentSections[0]?.id;
          const updatedSections = currentSections.map((sec) =>
            sec.id === activeSecId ? { ...sec, content: newContent, updatedAt: Date.now() } : sec
          );
          return {
            ...s,
            sections: updatedSections,
            content: updatedSections.map((sec) => sec.content).join('\n\n'),
            updatedAt: Date.now(),
          };
        })
      );
    },
    [activeScript.id, setScripts]
  );

  const handleCreateNewScript = useCallback(() => {
    const secId = `sec-${Date.now()}`;
    const newScript: ScriptData = {
      id: `script-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: 'Yeni Konuşma',
      sections: [
        {
          id: secId,
          title: '',
          content: '',
          updatedAt: Date.now(),
        },
      ],
      activeSectionId: secId,
      content: '',
      updatedAt: Date.now(),
    };
    setScripts((prev) => [newScript, ...prev]);
    setActiveScriptId(newScript.id);
  }, [setScripts, setActiveScriptId]);

  const handleDuplicateScript = useCallback(
    (id: string) => {
      setScripts((prev) => {
        const target = prev.find((s) => s.id === id);
        if (!target) return prev;
        const targetEnsured = ensureScriptSections(target);
        const copySections = targetEnsured.sections.map((sec, idx) => ({
          ...sec,
          id: `sec-${idx + 1}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          updatedAt: Date.now(),
        }));
        const copy: ScriptData = {
          ...targetEnsured,
          id: `script-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          title: `${targetEnsured.title} (Kopya)`,
          sections: copySections,
          activeSectionId: copySections[0]?.id,
          updatedAt: Date.now(),
        };
        setActiveScriptId(copy.id);
        return [copy, ...prev];
      });
    },
    [setScripts, setActiveScriptId]
  );

  const handleDeleteScript = useCallback(
    (id: string) => {
      setScripts((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (filtered.length === 0) {
          const secId = `sec-${Date.now()}`;
          const fallback: ScriptData = {
            id: `script-${Date.now()}`,
            title: 'Yeni Konuşma',
            sections: [
              {
                id: secId,
                title: '',
                content: '',
                updatedAt: Date.now(),
              },
            ],
            activeSectionId: secId,
            content: '',
            updatedAt: Date.now(),
          };
          setActiveScriptId(fallback.id);
          return [fallback];
        }
        if (activeScriptId === id) {
          setActiveScriptId(filtered[0].id);
        }
        return filtered;
      });
    },
    [setScripts, activeScriptId, setActiveScriptId]
  );

  const handleRenameScript = useCallback(
    (id: string, newTitle: string) => {
      setScripts((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: newTitle, updatedAt: Date.now() } : s))
      );
    },
    [setScripts]
  );

  const handleImportScript = useCallback(
    (imported: ScriptData) => {
      const ensured = ensureScriptSections(imported);
      setScripts((prev) => [ensured, ...prev]);
      setActiveScriptId(ensured.id);
    },
    [setScripts, setActiveScriptId]
  );

  // Auto-migrate old large default font size (52px -> 38px) for comfortable view
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const migrated = localStorage.getItem('biprompter_font_migration_v2');
        if (!migrated) {
          if (settings && settings.fontSize >= 50) {
            setSettings((prev) => ({ ...prev, fontSize: 38, marginWidth: 8 }));
          }
          localStorage.setItem('biprompter_font_migration_v2', 'true');
        }
      } catch (err) {
        console.warn('Migration error:', err);
      }
    }
  }, []);

  // Global Keyboard Shortcuts: Ctrl+N (New Script), Ctrl+B (Toggle Sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'editor') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateNewScript();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, handleCreateNewScript, setIsSidebarOpen]);

  // In editor mode, ALWAYS ensure screen capture protection is disabled and titlebar theme matches Antigravity
  useEffect(() => {
    if (mode === 'editor' && isTauri()) {
      invoke('set_screen_capture_protection', { enabled: false }).catch((err) => {
        console.warn('Failed to reset screen capture protection in editor mode:', err);
      });
      invoke('sync_titlebar_theme').catch(() => {});
    }
  }, [mode]);

  const handleLaunchPrompter = () => {
    if (settings.autoStart !== false && settings.enableCountdown) {
      setIsCountingDown(true);
    } else {
      setMode('prompter');
    }
  };

  const handleCountdownComplete = () => {
    setIsCountingDown(false);
    setMode('prompter');
  };

  const handleCountdownCancel = () => {
    setIsCountingDown(false);
  };

  const handleReturnToEditor = (elapsed?: number) => {
    if (isTauri()) {
      invoke('set_screen_capture_protection', { enabled: false }).catch(() => {});
    }
    if (typeof elapsed === 'number' && elapsed > 0) {
      setLastElapsedSeconds(elapsed);
    }
    setMode('editor');
  };

  const isRtl = settings.appLanguage === 'ar';

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
      document.documentElement.lang = settings.appLanguage || 'tr';
    }
  }, [isRtl, settings.appLanguage]);

  const isIslandMode = mode === 'prompter';

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`${
        isIslandMode
          ? 'w-screen h-screen bg-transparent overflow-hidden'
          : 'w-screen h-screen bg-[#101010] overflow-hidden text-[#EDEDED]'
      } font-sans selection:bg-white/20 selection:text-white flex flex-col`}
    >
      {/* Editor Mode */}
      {mode === 'editor' && (
        <>
          <Header
            mode="editor"
            onModeChange={setMode}
            onLaunchPrompter={handleLaunchPrompter}
            appLanguage={settings.appLanguage || 'tr'}
            onUpdateAppLanguage={(lang) => setSettings((prev) => ({ ...prev, appLanguage: lang }))}
            onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            isSidebarOpen={isSidebarOpen}
            scriptTitle={activeScript.title || 'İsimsiz Konuşma'}
            sectionTitle={activeSection?.title || 'Metin Başlığı...'}
            onOpenWelcome={() => setShowWelcome(true)}
          />

          <main className="flex-1 overflow-hidden">
            <EditorView
              script={activeScript}
              activeSection={activeSection}
              onUpdateScript={handleUpdateActiveScript}
              onUpdateActiveSectionTitle={handleUpdateActiveSectionTitle}
              onUpdateActiveSectionContent={handleUpdateActiveSectionContent}
              settings={settings}
              onUpdateSettings={setSettings}
              onLaunchPrompter={handleLaunchPrompter}
              lastElapsedSeconds={lastElapsedSeconds}
              scripts={scripts}
              onSelectScript={handleSelectScript}
              onSelectSection={handleSelectSection}
              onAddSection={handleAddSection}
              onDeleteSection={handleDeleteSection}
              onRenameSection={handleRenameSection}
              onDuplicateSection={handleDuplicateSection}
              onCreateNewScript={handleCreateNewScript}
              onDuplicateScript={handleDuplicateScript}
              onDeleteScript={handleDeleteScript}
              onRenameScript={handleRenameScript}
              onImportScript={handleImportScript}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            />
          </main>
        </>
      )}

      {/* Prompter Mode */}
      {mode === 'prompter' && (
        <PrompterView
          script={activeScript}
          settings={settings}
          onUpdateSettings={setSettings}
          onReturnToEditor={handleReturnToEditor}
        />
      )}

      {/* 3.. 2.. 1.. Countdown Modal */}
      {isCountingDown && (
        <CountdownOverlay
          duration={settings.countdownDuration || 3}
          onComplete={handleCountdownComplete}
          onCancel={handleCountdownCancel}
          appLanguage={settings.appLanguage}
        />
      )}

      {/* Welcome & Startup Opening Screen */}
      {showWelcome && mode === 'editor' && (
        <WelcomeScreen
          isOpen={showWelcome}
          onClose={() => {
            setShowWelcome(false);
            setIsInitialLaunch(false);
          }}
          activeScript={activeScript}
          scripts={scripts}
          onSelectScript={handleSelectScript}
          onCreateNewScript={handleCreateNewScript}
          onImportScript={handleImportScript}
          onLaunchPrompter={handleLaunchPrompter}
          settings={settings}
          onUpdateSettings={setSettings}
          appLanguage={settings.appLanguage}
          isInitialLaunch={isInitialLaunch}
        />
      )}
    </div>
  );
};
