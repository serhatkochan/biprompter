import React, { useState, useEffect } from 'react';
import { Play, X } from 'lucide-react';
import type { AppLanguage } from '../types/prompter';
import { getTranslations } from '../i18n/translations';

interface CountdownOverlayProps {
  duration?: number;
  onComplete: () => void;
  onCancel: () => void;
  appLanguage?: AppLanguage;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  duration = 3,
  onComplete,
  onCancel,
  appLanguage = 'tr',
}) => {
  const [count, setCount] = useState<number>(duration);
  const t = getTranslations(appLanguage);

  useEffect(() => {
    if (count <= 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCount((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm select-none transition-all duration-200">
      <div className="relative flex flex-col items-center max-w-sm w-full mx-4">
        {/* Minimalist Typographic Dial */}
        <div className="relative flex items-center justify-center my-8">
          <div className="w-32 h-32 rounded-full border border-neutral-700 bg-neutral-950 flex items-center justify-center">
            <span className="text-7xl font-light text-white font-mono tabular-nums tracking-tighter">
              {count > 0 ? count : <Play className="w-10 h-10 fill-white text-white" />}
            </span>
          </div>
        </div>

        {/* Minimalist Status Header */}
        <div className="text-center">
          <div className="inline-block px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 text-[10px] font-mono uppercase tracking-widest font-medium mb-2">
            Geri Sayım
          </div>
          <h3 className="text-sm font-semibold text-white tracking-wide">
            {count > 0 ? t.countdownPreparing : t.countdownStarted}
          </h3>
          <p className="text-xs text-neutral-400 mt-1 font-mono">
            {t.countdownHint}
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={onComplete}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-colors active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            <span>{t.countdownStartNow}</span>
          </button>

          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium border border-neutral-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t.countdownCancel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
