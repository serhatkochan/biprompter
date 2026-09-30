import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus,
  MoreVertical,
  Trash2,
  Copy,
  Edit2,
  Search,
  PanelLeftClose,
  PanelLeft,
  Folder,
} from 'lucide-react';
import type { ScriptData, ScriptSection } from '../types/prompter';
import { formatTimeAgo } from '../utils/scriptStorage';

interface SidebarLibraryTreeProps {
  scripts: ScriptData[];
  activeScriptId: string;
  onSelectScript: (script: ScriptData) => void;
  onSelectSection?: (scriptId: string, sectionId: string) => void;
  onAddSection?: (scriptId: string) => void;
  onDeleteSection?: (scriptId: string, sectionId: string) => void;
  onRenameSection?: (scriptId: string, sectionId: string, newTitle: string) => void;
  onDuplicateSection?: (scriptId: string, sectionId: string) => void;
  onCreateNewScript: () => void;
  onDuplicateScript: (id: string) => void;
  onDeleteScript: (id: string) => void;
  onRenameScript: (id: string, newTitle: string) => void;
  onImportScript?: (imported: ScriptData) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const SidebarLibraryTree: React.FC<SidebarLibraryTreeProps> = ({
  scripts,
  activeScriptId,
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
  isOpen,
  onToggleOpen,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [menuOpenScriptId, setMenuOpenScriptId] = useState<string | null>(null);
  const [editingSectionKey, setEditingSectionKey] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');
  const [menuOpenSectionKey, setMenuOpenSectionKey] = useState<string | null>(null);
  const [collapsedScriptIds, setCollapsedScriptIds] = useState<Set<string>>(new Set());

  // Close context menus when clicking outside or pressing Escape
  useEffect(() => {
    if (!menuOpenScriptId && !menuOpenSectionKey) return;

    const handleDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-context-menu]')) {
        setMenuOpenScriptId(null);
        setMenuOpenSectionKey(null);
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpenScriptId(null);
        setMenuOpenSectionKey(null);
      }
    };

    window.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [menuOpenScriptId, menuOpenSectionKey]);

  // Filter scripts by search query (checks conversation title, section titles, and section contents)
  const filteredScripts = useMemo(() => {
    if (!searchQuery.trim()) return scripts;
    const q = searchQuery.toLowerCase();
    return scripts.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.sections || []).some(
          (sec) => sec.title.toLowerCase().includes(q) || sec.content.toLowerCase().includes(q)
        )
    );
  }, [scripts, searchQuery]);

  const toggleCollapse = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCollapsedScriptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const activeScript = useMemo(
    () => scripts.find((s) => s.id === activeScriptId) || scripts[0],
    [scripts, activeScriptId]
  );

  // Rename handlers for Conversation Title
  const handleStartRename = (s: ScriptData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingScriptId(s.id);
    setEditingTitle(s.title);
    setMenuOpenScriptId(null);
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim()) {
      onRenameScript(id, editingTitle.trim());
    }
    setEditingScriptId(null);
  };

  const handleSaveRenameSection = (scriptId: string, sectionId: string) => {
    if (editingSectionTitle.trim() && onRenameSection) {
      onRenameSection(scriptId, sectionId, editingSectionTitle.trim());
    }
    setEditingSectionKey(null);
  };

  const handleAddSectionClick = (scriptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedScriptIds((prev) => {
      const next = new Set(prev);
      next.delete(scriptId);
      return next;
    });
    onAddSection?.(scriptId);
  };

  return (
    <aside
      className={`h-full flex flex-col bg-[#161616] text-[#EDEDED] select-none shrink-0 overflow-hidden transition-[width,opacity,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width,opacity] ${
        isOpen
          ? 'w-68 sm:w-72 md:w-80 border-r border-white/[0.06] opacity-100 pointer-events-auto'
          : 'w-0 border-r-0 opacity-0 pointer-events-none'
      }`}
      aria-hidden={!isOpen}
    >
      {/* Fixed-width inner container prevents text squishing during smooth width animation */}
      <div
        className={`w-68 sm:w-72 md:w-80 h-full flex flex-col shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'translate-x-0' : '-translate-x-4'
        }`}
      >
        {/* Top Header: Antigravity IDE style */}
        <div className="px-3 pt-3 pb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#8B8D98]">
            Konuşmalar ({filteredScripts.length})
          </span>
        <button
          onClick={onCreateNewScript}
          className="p-1 rounded cursor-pointer text-[#8B8D98] hover:text-[#EDEDED] hover:bg-white/[0.06] transition-colors"
          title="Yeni Konuşma Ekle (Ctrl + N)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Bar */}
      {scripts.length > 3 && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.08] focus-within:border-white/30 text-xs text-[#EDEDED] transition-all">
            <Search className="w-3.5 h-3.5 text-[#5C5E69] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Konuşmalarda ara..."
              className="w-full bg-transparent outline-none text-xs placeholder:text-[#5C5E69] text-[#EDEDED]"
            />
          </div>
        </div>
      )}

      {/* Script Tree Section */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1">
        {filteredScripts.map((s) => {
          const isActive = s.id === activeScriptId;
          const isEditing = editingScriptId === s.id;
          const isMenuOpen = menuOpenScriptId === s.id;
          const isExpanded = !collapsedScriptIds.has(s.id);

          return (
            <div key={s.id} className="relative group">
              {/* Script Main Folder Row */}
              <div
                onClick={() => {
                  onSelectScript(s);
                  toggleCollapse(s.id);
                }}
                className="flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer select-none transition-colors duration-75 relative bg-transparent text-[#8B8D98] hover:text-[#EDEDED]"
              >
                {/* Left: Folder Icon + Title */}
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
                  <Folder className="w-3.5 h-3.5 text-[#8B8D98] group-hover:text-[#EDEDED] shrink-0 transition-colors" />

                  {isEditing ? (
                    <input
                      type="text"
                      value={editingTitle}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleSaveRename(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(s.id);
                        if (e.key === 'Escape') setEditingScriptId(null);
                      }}
                      className="w-full bg-[#1E1E1E] text-[#EDEDED] px-1.5 py-0.5 rounded border border-white/20 outline-none text-xs font-normal"
                    />
                  ) : (
                    <span className="truncate font-normal transition-colors" title={s.title || 'İsimsiz Konuşma'}>
                      {s.title || 'İsimsiz Konuşma'}
                    </span>
                  )}
                </div>

                {/* Right metadata / actions: First 3 dots, then + */}
                <div className="flex items-center gap-0.5 shrink-0" data-context-menu>
                  {/* Context Menu Button (3 dots) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenScriptId(isMenuOpen ? null : s.id);
                    }}
                    className={`p-1 rounded cursor-pointer text-[#8B8D98] hover:text-[#EDEDED] hover:bg-white/[0.08] transition-all duration-75 ${
                      isMenuOpen ? 'opacity-100 bg-white/[0.08]' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    title="Seçenekler"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </button>

                  {/* Add Section Button (+) */}
                  <button
                    onClick={(e) => handleAddSectionClick(s.id, e)}
                    className="p-1 rounded cursor-pointer text-[#8B8D98] hover:text-[#EDEDED] hover:bg-white/[0.08] opacity-0 group-hover:opacity-100 transition-all duration-75"
                    title="Yeni Metin Ekle (+)"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Context Action Menu Dropdown */}
              {isMenuOpen && (
                <div
                  data-context-menu
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-2 top-8 z-30 w-44 py-1 rounded-md bg-[#1E1E1E] border border-white/[0.1] shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-100"
                >
                  <button
                    onClick={(e) => handleStartRename(s, e)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[#EDEDED] hover:bg-white/[0.06] text-left transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#8B8D98]" />
                    <span>Yeniden Adlandır</span>
                  </button>
                  <button
                    onClick={() => {
                      onDuplicateScript(s.id);
                      setMenuOpenScriptId(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[#EDEDED] hover:bg-white/[0.06] text-left transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#8B8D98]" />
                    <span>Kopyasını Çıkar</span>
                  </button>
                  {scripts.length > 1 && (
                    <button
                      onClick={() => {
                        onDeleteScript(s.id);
                        setMenuOpenScriptId(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-red-500/10 text-left border-t border-white/[0.06] mt-1 pt-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Sil</span>
                    </button>
                  )}
                </div>
              )}

              {/* Sections Subtree */}
              {isExpanded && (
                <div className="ml-4 my-0.5 space-y-0.5">
                  {(s.sections || []).map((sec, secIdx) => {
                    const isSecActive =
                      isActive &&
                      (s.activeSectionId === sec.id || (!s.activeSectionId && secIdx === 0));
                    const timeAgo = formatTimeAgo(sec.updatedAt || s.updatedAt);
                    const sectionKey = `${s.id}-${sec.id}`;
                    const isSecEditing = editingSectionKey === sectionKey;
                    const isSecMenuOpen = menuOpenSectionKey === sectionKey;

                    return (
                      <div
                        key={sec.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isActive) {
                            onSelectScript(s);
                          }
                          onSelectSection?.(s.id, sec.id);
                        }}
                        className={`relative flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors duration-75 group/sec ${
                          isSecActive
                            ? 'bg-[#282828] text-[#EDEDED] font-medium border border-white/[0.08]'
                            : 'bg-transparent text-[#8B8D98] hover:text-[#EDEDED] border border-transparent'
                        }`}
                      >
                        {isSecEditing ? (
                          <input
                            type="text"
                            value={editingSectionTitle}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingSectionTitle(e.target.value)}
                            onBlur={() => handleSaveRenameSection(s.id, sec.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRenameSection(s.id, sec.id);
                              if (e.key === 'Escape') setEditingSectionKey(null);
                            }}
                            className="w-full bg-[#1E1E1E] text-[#EDEDED] px-1.5 py-0.5 rounded border border-white/20 outline-none text-xs font-normal"
                            placeholder="Metin Başlığı..."
                          />
                        ) : (
                          <span className="truncate min-w-0 flex-1 mr-2 font-normal" title={sec.title || 'Metin Başlığı...'}>
                            {sec.title || 'Metin Başlığı...'}
                          </span>
                        )}

                        {!isSecEditing && (
                          <div className="flex items-center gap-0.5 shrink-0" data-context-menu>
                            {/* 3 dots button on hover or when open (aligned with folder's 3-dots) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenSectionKey(isSecMenuOpen ? null : sectionKey);
                                setMenuOpenScriptId(null);
                              }}
                              className={`p-1 rounded cursor-pointer text-[#8B8D98] hover:text-[#EDEDED] hover:bg-white/[0.08] transition-all duration-75 ${
                                isSecMenuOpen
                                  ? 'opacity-100 bg-white/[0.08]'
                                  : 'opacity-0 group-hover/sec:opacity-100'
                              }`}
                              title="Seçenekler"
                            >
                              <MoreVertical className="w-3 h-3" />
                            </button>

                            {/* Far right slot: shows timeAgo when not hovered/open, or empty spacer matching folder row's + button */}
                            <div className="w-[22px] h-[22px] flex items-center justify-center shrink-0 pointer-events-none">
                              {timeAgo && !isSecMenuOpen && (
                                <span className="text-[11px] text-[#8B8D98] font-mono tabular-nums group-hover/sec:hidden">
                                  {timeAgo}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Section Context Action Menu Dropdown */}
                        {isSecMenuOpen && (
                          <div
                            data-context-menu
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-2 top-8 z-30 w-44 py-1 rounded-md bg-[#1E1E1E] border border-white/[0.1] shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-100"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSectionKey(sectionKey);
                                setEditingSectionTitle(sec.title || '');
                                setMenuOpenSectionKey(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-[#EDEDED] hover:bg-white/[0.06] text-left transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#8B8D98]" />
                              <span>Yeniden Adlandır</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateSection?.(s.id, sec.id);
                                setMenuOpenSectionKey(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-[#EDEDED] hover:bg-white/[0.06] text-left transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 text-[#8B8D98]" />
                              <span>Kopyasını Çıkar</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSection?.(s.id, sec.id);
                                setMenuOpenSectionKey(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-red-500/10 text-left border-t border-white/[0.06] mt-1 pt-1.5 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Sil</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </aside>
  );
};
