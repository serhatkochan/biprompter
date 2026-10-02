import React from 'react';
import { Play, FileEdit, Monitor, Globe, PanelLeft } from 'lucide-react';
import type { AppLanguage } from '../types/prompter';
import { getTranslations } from '../i18n/translations';
import { APP_LANGUAGES } from '../utils/modelCatalog';

interface HeaderProps {
  mode: 'editor' | 'prompter';
  onModeChange: (mode: 'editor' | 'prompter') => void;
  onLaunchPrompter: () => void;
  appLanguage: AppLanguage;
  onUpdateAppLanguage: (lang: AppLanguage) => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  scriptTitle?: string;
  sectionTitle?: string;
  activeScriptTitle?: string;
  onOpenWelcome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onModeChange,
  onLaunchPrompter,
  appLanguage,
  onUpdateAppLanguage,
  onToggleSidebar,
  isSidebarOpen = true,
  scriptTitle,
  sectionTitle,
  activeScriptTitle,
  onOpenWelcome,
}) => {
  const t = getTranslations(appLanguage || 'tr');

  // Derive conversation & section titles cleanly
  const displayScriptTitle =
    scriptTitle ||
    (activeScriptTitle ? activeScriptTitle.split(' / ')[0] : 'İsimsiz Konuşma');
  const displaySectionTitle =
    sectionTitle !== undefined
      ? sectionTitle
      : activeScriptTitle && activeScriptTitle.includes(' / ')
      ? activeScriptTitle.split(' / ').slice(1).join(' / ')
      : null;

  return (
    <header
      data-tauri-drag-region
      className="w-full h-11 bg-[#161616] border-b border-white/[0.06] sticky top-0 z-40 px-3 sm:px-4 flex items-center justify-between select-none text-[#EDEDED]"
    >
      {/* Sidebar Toggle & Clean Breadcrumb: Konuşma Başlığı / Metin Başlığı */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onOpenWelcome && (
          <button
            onClick={onOpenWelcome}
            className="w-6 h-6 bg-white hover:bg-neutral-200 text-black font-extrabold text-[11px] rounded flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer shrink-0 shadow-xs"
            title="Biprompter Açılış Ekranı ve Hızlı Başlatıcı"
          >
            Bi
          </button>
        )}

        {mode === 'editor' && onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`p-1.5 rounded cursor-pointer transition-all duration-150 ${
              isSidebarOpen
                ? 'text-white bg-white/[0.08]'
                : 'text-[#8B8D98] hover:text-white hover:bg-white/[0.06]'
            } active:scale-[0.96] shrink-0`}
            title={isSidebarOpen ? 'Sol Paneli Daralt (Ctrl + B)' : 'Sol Paneli Genişlet (Ctrl + B)'}
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="flex items-center text-xs min-w-0 select-none">
          <span
            className="text-[#8B8D98] font-normal truncate max-w-[180px] sm:max-w-[240px] md:max-w-[320px]"
            title={displayScriptTitle}
          >
            {displayScriptTitle}
          </span>
          {displaySectionTitle && (
            <>
              <span className="text-white/20 mx-2 text-xs shrink-0 select-none">/</span>
              <span
                className="text-[#8B8D98] font-normal truncate max-w-[200px] sm:max-w-[280px] md:max-w-[380px]"
                title={displaySectionTitle}
              >
                {displaySectionTitle}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right Controls: App Language & Main Action */}
      <div className="flex items-center gap-2">
        {/* Global App Interface Language Selector */}
        <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] hover:border-white/20 rounded-md px-2.5 py-1 transition-colors cursor-pointer">
          <Globe className="w-3.5 h-3.5 text-[#8B8D98] shrink-0" />
          <select
            value={appLanguage || 'tr'}
            onChange={(e) => onUpdateAppLanguage(e.target.value as AppLanguage)}
            className="bg-transparent text-xs font-medium text-[#EDEDED] outline-none cursor-pointer"
            aria-label={t.appLanguage}
          >
            {APP_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-[#161616] text-[#EDEDED] py-1">
                {lang.nativeName}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onLaunchPrompter}
          className="flex items-center gap-1.5 bg-white/[0.12] hover:bg-white/[0.18] text-[#EDEDED] hover:text-white border border-white/[0.16] font-medium px-3.5 py-1.5 rounded-md text-xs cursor-pointer transition-all duration-150 active:scale-[0.98] shadow-xs"
        >
          <Play className="w-3 h-3 fill-current text-[#EDEDED]" />
          <span className="whitespace-nowrap">Prompter'ı Aç</span>
        </button>
      </div>
    </header>
  );
};
