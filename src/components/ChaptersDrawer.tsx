import React from 'react';
import type { Chapter } from '../utils/chapterParser';
import { Bookmark, ChevronRight, X } from 'lucide-react';

interface ChaptersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: Chapter[];
  currentWordIndex?: number;
  activeChapterId?: string;
  onJumpToChapter?: (chapter: Chapter) => void;
  onSelectChapter?: (chapter: Chapter) => void;
}

export const ChaptersDrawer: React.FC<ChaptersDrawerProps> = ({
  isOpen,
  onClose,
  chapters,
  currentWordIndex = 0,
  activeChapterId,
  onJumpToChapter,
  onSelectChapter,
}) => {
  if (!isOpen) return null;

  const handleSelect = (chap: Chapter) => {
    if (onSelectChapter) {
      onSelectChapter(chap);
    } else if (onJumpToChapter) {
      onJumpToChapter(chap);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end pointer-events-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-80 sm:w-96 h-full bg-[#1E1E1E] border-l border-white/[0.1] shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 text-[#EDEDED]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#1E1E1E] border border-white/[0.08] flex items-center justify-center text-white">
              <Bookmark className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white tracking-wider uppercase">Bölümler ve Duraklar</h3>
              <p className="text-[11px] text-[#8B8D98]">Metin içindeki duraklar</p>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#262626] text-white border border-white/[0.08] ml-1">
              {chapters.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#8B8D98] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chapters List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {chapters.length === 0 ? (
            <div className="text-center py-16 text-[#8B8D98] text-xs px-4">
              <p className="font-medium text-[#C5C7D0]">Metninizde henüz bölüm ayracı bulunamadı.</p>
              <p className="text-[11px] text-[#71737F] mt-2 leading-relaxed">
                Editörde metninizin içine <code className="text-white bg-[#161616] border border-white/[0.08] px-1.5 py-0.5 rounded font-mono"># Bölüm 1</code> veya <code className="text-white bg-[#161616] border border-white/[0.08] px-1.5 py-0.5 rounded font-mono">---</code> yazarak bölüm oluşturabilirsiniz.
              </p>
            </div>
          ) : (
            chapters.map((chap, idx) => {
              const nextChap = chapters[idx + 1];
              const isActive = activeChapterId
                ? chap.id === activeChapterId
                : currentWordIndex >= chap.wordIndex &&
                  (!nextChap || currentWordIndex < nextChap.wordIndex);

              return (
                <div
                  key={chap.id}
                  onClick={() => handleSelect(chap)}
                  className={`group flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#282828] border-white/30 shadow-xs'
                      : 'bg-[#161616] border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-xs font-semibold shrink-0 transition-colors ${
                        isActive
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#101010] text-[#8B8D98] border border-white/[0.08]'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h4
                        className={`text-xs font-medium truncate transition-colors ${
                          isActive ? 'text-white font-semibold' : 'text-[#C5C7D0] group-hover:text-white'
                        }`}
                      >
                        {chap.title}
                      </h4>
                      <span className="text-[10px] text-[#71737F] font-mono mt-0.5 block tabular-nums">
                        Kelime: {chap.wordIndex + 1}
                      </span>
                    </div>
                  </div>

                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      isActive
                        ? 'text-white translate-x-0.5'
                        : 'text-[#5C5E69] group-hover:text-[#8B8D98]'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Shortcuts Footer */}
        <div className="p-3 border-t border-white/[0.08] text-[10px] text-[#8B8D98] text-center bg-[#161616] font-mono flex items-center justify-center gap-2">
          <kbd className="px-1.5 py-0.5 bg-[#262626] rounded border border-white/[0.08] text-[#EDEDED] text-[10px] shadow-xs">PageDown / ]</kbd>
          <span>Sonraki</span>
          <span>•</span>
          <kbd className="px-1.5 py-0.5 bg-[#262626] rounded border border-white/[0.08] text-[#EDEDED] text-[10px] shadow-xs">PageUp / [</kbd>
          <span>Önceki</span>
        </div>
      </div>
    </div>
  );
};
