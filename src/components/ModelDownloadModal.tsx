import React, { useState, useEffect, useRef } from 'react';
import { Download, CheckCircle2, AlertCircle, Loader2, X, RefreshCw, HardDrive } from 'lucide-react';
import type { SpeechLanguage, AppLanguage } from '../types/prompter';
import { SPEECH_MODELS } from '../utils/modelCatalog';
import { downloadModelWithProgress, type DownloadProgress } from '../utils/modelStorage';
import { getTranslations } from '../i18n/translations';

interface ModelDownloadModalProps {
  language: SpeechLanguage;
  appLanguage: AppLanguage;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (language: SpeechLanguage) => void;
}

export const ModelDownloadModal: React.FC<ModelDownloadModalProps> = ({
  language,
  appLanguage,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const t = getTranslations(appLanguage);
  const modelInfo = SPEECH_MODELS[language];

  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setProgress(null);
      setIsDownloading(false);
      setIsSuccess(false);
      setErrorMsg(null);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [isOpen]);

  if (!isOpen || !modelInfo) return null;

  const handleStartDownload = async () => {
    setIsDownloading(true);
    setErrorMsg(null);
    setIsSuccess(false);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await downloadModelWithProgress(
        modelInfo.modelId,
        modelInfo.downloadUrls,
        (p) => {
          setProgress(p);
        },
        abortController.signal
      );

      setIsDownloading(false);
      setIsSuccess(true);
      setTimeout(() => {
        onSuccess(language);
        onClose();
      }, 1200);
    } catch (err: any) {
      if (abortController.signal.aborted) {
        setIsDownloading(false);
        setProgress(null);
        return;
      }
      setIsDownloading(false);
      setErrorMsg(err?.message || t.downloadModalError);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    onClose();
  };

  const formatMb = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0.0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#1E1E1E] border border-white/[0.1] rounded-lg p-6 shadow-2xl flex flex-col gap-5 text-[#EDEDED]">
        {/* Close Button */}
        {!isDownloading && (
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 p-1.5 text-[#8B8D98] hover:text-white rounded-md hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-md bg-[#161616] border border-white/[0.08] flex items-center justify-center text-xl shrink-0">
            {modelInfo.flag}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white leading-tight">
                {modelInfo.nativeName}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#161616] border border-white/[0.08] text-[#8B8D98] font-mono">
                {modelInfo.estimatedSize}
              </span>
            </div>
            <p className="text-xs text-[#8B8D98] mt-0.5">{t.downloadModalTitle}</p>
          </div>
        </div>

        {/* Informative Card */}
        <div className="bg-[#161616] border border-white/[0.08] rounded-md p-3.5 flex flex-col gap-2.5">
          <div className="flex items-start gap-3">
            <HardDrive className="w-4 h-4 text-white shrink-0 mt-0.5" />
            <p className="text-xs text-[#C5C7D0] leading-relaxed">
              {t.downloadModalPrompt}
            </p>
          </div>

          <div className="text-[10px] text-[#71737F] font-mono flex items-center gap-1.5 pt-1.5 border-t border-white/[0.08]">
            <span>Model ID:</span>
            <span className="text-white font-medium">{modelInfo.modelId}</span>
          </div>
        </div>

        {/* Progress Display */}
        {isDownloading && progress && (
          <div className="flex flex-col gap-2 bg-[#161616] border border-white/[0.08] rounded-md p-3.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-white flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8B8D98]" />
                {progress.status === 'connecting'
                  ? 'Sunucuya bağlanılıyor...'
                  : progress.status === 'saving'
                  ? 'Yerel hafızaya kaydediliyor...'
                  : t.modelDownloading}
              </span>
              <span className="text-white font-mono tabular-nums font-semibold text-xs">
                %{progress.percent}
              </span>
            </div>

            {/* Progress Track */}
            <div className="w-full bg-white/[0.08] h-1.5 rounded-full overflow-hidden relative">
              <div
                className="bg-white h-full rounded-full transition-all duration-150 ease-out"
                style={{ width: `${Math.max(4, progress.percent)}%` }}
              />
            </div>

            {/* Byte Counters */}
            <div className="flex items-center justify-between text-[10px] text-[#71737F] font-mono tabular-nums">
              <span>{formatMb(progress.receivedBytes)}</span>
              <span>{formatMb(progress.totalBytes)}</span>
            </div>
          </div>
        )}

        {/* Success State */}
        {isSuccess && (
          <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md p-3 text-xs font-medium animate-in zoom-in-95">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{t.downloadModalSuccess}</span>
          </div>
        )}

        {/* Error State */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-md p-3 text-xs leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">{t.downloadModalError}</span>
              <span className="text-[11px] opacity-90">{errorMsg}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          {!isDownloading && !isSuccess && (
            <>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 rounded-md bg-[#262626] hover:bg-[#303030] text-[#8B8D98] hover:text-white text-xs font-medium border border-white/[0.08] hover:border-white/[0.15] transition-colors cursor-pointer"
              >
                {t.downloadModalCancel}
              </button>

              <button
                type="button"
                onClick={handleStartDownload}
                className="flex items-center gap-1.5 px-5 py-2 rounded-md bg-white hover:bg-neutral-200 text-black text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {errorMsg ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t.downloadModalRetry}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.downloadModalAction}</span>
                  </>
                )}
              </button>
            </>
          )}

          {isDownloading && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-md bg-[#262626] hover:bg-[#303030] text-[#8B8D98] hover:text-white text-xs font-medium border border-white/[0.08] transition-colors ml-auto cursor-pointer"
            >
              {t.downloadModalCancel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
