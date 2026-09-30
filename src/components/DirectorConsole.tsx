import React, { useState } from 'react';
import { Send, X, MessageSquare, Sparkles, Trash2 } from 'lucide-react';

interface DirectorConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage?: (msg: string) => void;
  onSendCue?: (msg: string) => void;
  onClearMessage?: () => void;
  currentMessage?: string | null;
}

const PRESET_MESSAGES = [
  { label: 'Gülümseyin', text: 'Gülümseyin' },
  { label: 'Daha Yavaş ve Sakin', text: 'Biraz daha sakin ve yavaş konuşun' },
  { label: 'Sesini ve Enerjini Artır', text: 'Sesini yükselt ve enerjini artır' },
  { label: 'Son 1 Dakika', text: 'Son 1 dakikan kaldı, toparla' },
  { label: 'Kameraya Odaklan', text: 'Gözlerini kameradan ayırma' },
  { label: 'Harika Gidiyorsun', text: 'Çok iyi gidiyorsun, aynen devam!' },
];

export const DirectorConsole: React.FC<DirectorConsoleProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  onSendCue,
  onClearMessage,
  currentMessage,
}) => {
  const [customText, setCustomText] = useState('');

  if (!isOpen) return null;

  const handleSend = (text: string) => {
    if (onSendCue) {
      onSendCue(text);
    } else if (onSendMessage) {
      onSendMessage(text);
    }
  };

  const handleSendCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (customText.trim()) {
      handleSend(customText.trim());
      setCustomText('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-[#1E1E1E] border border-white/[0.1] rounded-lg p-5 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200 text-[#EDEDED]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#161616] border border-white/[0.08] flex items-center justify-center text-white">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white tracking-wider uppercase">Reji & Yönetmen İletişimi</h3>
              <p className="text-[11px] text-[#8B8D98]">Prompter ekranına canlı sessiz uyarı gönder</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#8B8D98] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Active Message Status */}
        {currentMessage && (
          <div className="mb-4 p-3 rounded-md bg-[#161616] border border-white/[0.08] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-white shrink-0" />
              <div className="min-w-0">
                <span className="text-[9px] font-mono font-semibold text-[#71737F] uppercase tracking-wider block">
                  Ekranda Gösterilen Mesaj:
                </span>
                <span className="text-xs text-white font-medium truncate block">{currentMessage}</span>
              </div>
            </div>
            {onClearMessage && (
              <button
                onClick={onClearMessage}
                title="Mesajı Ekrandan Kaldır"
                className="p-1.5 rounded-md bg-[#101010] hover:bg-red-500/10 text-[#8B8D98] hover:text-red-400 border border-white/[0.08] hover:border-red-500/20 transition-colors shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Preset Quick Buttons */}
        <div className="space-y-2 mb-4">
          <span className="text-[11px] text-[#8B8D98] font-medium">Hızlı Reji Mesajları:</span>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_MESSAGES.map((preset) => (
              <button
                key={preset.text}
                onClick={() => {
                  handleSend(preset.text);
                  onClose();
                }}
                className="text-left px-3 py-2.5 rounded-md bg-[#161616] border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.06] text-xs text-[#EDEDED] hover:text-white font-medium transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Text Input Form */}
        <form onSubmit={handleSendCustom} className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Özel reji mesajı yazın (Örn: Bu kısmı baştan al)..."
              className="w-full bg-[#101010] border border-white/[0.08] rounded-md px-3 py-2 text-xs text-[#EDEDED] placeholder-[#5C5E69] focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs text-[#8B8D98] hover:text-white transition-colors cursor-pointer"
            >
              Kapat (ESC)
            </button>
            <button
              type="submit"
              disabled={!customText.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:pointer-events-none text-black font-semibold text-xs rounded-md shadow-xs transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 fill-black text-black" />
              <span>Ekrana Gönder</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
