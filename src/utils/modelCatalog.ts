import type { SpeechLanguage, AppLanguage } from '../types/prompter';

export interface SpeechModelInfo {
  code: SpeechLanguage;
  name: string;
  nativeName: string;
  flag: string;
  modelId: string;
  estimatedSize: string;
  isBundled: boolean;
  bundledPath?: string;
  downloadUrls: string[];
}

export interface AppLanguageInfo {
  code: AppLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const APP_LANGUAGES: AppLanguageInfo[] = [
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
];

export const SPEECH_MODELS: Record<SpeechLanguage, SpeechModelInfo> = {
  'tr-TR': {
    code: 'tr-TR',
    name: 'Turkish',
    nativeName: 'Türkçe',
    flag: '🇹🇷',
    modelId: 'vosk-model-small-tr-0.3',
    estimatedSize: '36 MB',
    isBundled: false,
    downloadUrls: [
      'https://alphacephei.com/vosk/models/vosk-model-small-tr-0.3.zip',
      'https://huggingface.co/rhasspy/vosk-models/resolve/main/tr/vosk-model-small-tr-0.3.zip',
    ],
  },
  'en-US': {
    code: 'en-US',
    name: 'English (US)',
    nativeName: 'English',
    flag: '🇺🇸',
    modelId: 'vosk-model-small-en-us-0.15',
    estimatedSize: '40 MB',
    isBundled: false,
    downloadUrls: [
      'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
      'https://huggingface.co/rhasspy/vosk-models/resolve/main/en/vosk-model-small-en-us-0.15.zip',
    ],
  },
  'es-ES': {
    code: 'es-ES',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    modelId: 'vosk-model-small-es-0.42',
    estimatedSize: '39 MB',
    isBundled: false,
    downloadUrls: [
      'https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip',
      'https://huggingface.co/rhasspy/vosk-models/resolve/main/es/vosk-model-small-es-0.42.zip',
    ],
  },
  'de-DE': {
    code: 'de-DE',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    modelId: 'vosk-model-small-de-0.15',
    estimatedSize: '45 MB',
    isBundled: false,
    downloadUrls: [
      'https://alphacephei.com/vosk/models/vosk-model-small-de-0.15.zip',
      'https://huggingface.co/rhasspy/vosk-models/resolve/main/de/vosk-model-small-de-0.15.zip',
    ],
  },
  'fr-FR': {
    code: 'fr-FR',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    modelId: 'vosk-model-small-fr-0.22',
    estimatedSize: '41 MB',
    isBundled: false,
    downloadUrls: [
      'https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip',
      'https://huggingface.co/rhasspy/vosk-models/resolve/main/fr/vosk-model-small-fr-0.22.zip',
    ],
  },
  'pt-BR': {
    code: 'pt-BR',
    name: 'Portuguese (BR)',
    nativeName: 'Português',
    flag: '🇧🇷',
    modelId: 'vosk-model-small-pt-0.3',
    estimatedSize: '31 MB',
    isBundled: false,
    downloadUrls: [
      'https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip',
      'https://huggingface.co/rhasspy/vosk-models/resolve/main/pt/vosk-model-small-pt-0.3.zip',
    ],
  },
  'it-IT': {
    code: 'it-IT',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    modelId: 'vosk-model-small-it-0.22',
    estimatedSize: '45 MB',
    isBundled: false,
    downloadUrls: [
      'https://alphacephei.com/vosk/models/vosk-model-small-it-0.22.zip',
      'https://huggingface.co/rhasspy/vosk-models/resolve/main/it/vosk-model-small-it-0.22.zip',
    ],
  },
  'ru-RU': {
    code: 'ru-RU',
    name: 'Russian',
    nativeName: 'Русский',
    flag: '🇷🇺',
    modelId: 'vosk-model-small-ru-0.22',
    estimatedSize: '45 MB',
    isBundled: false,
    downloadUrls: [
      'https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip',
      'https://huggingface.co/rhasspy/vosk-models/resolve/main/ru/vosk-model-small-ru-0.22.zip',
    ],
  },
  'ja-JP': {
    code: 'ja-JP',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    modelId: 'vosk-model-small-ja-0.22',
    estimatedSize: '48 MB',
    isBundled: false,
    downloadUrls: [
      'https://alphacephei.com/vosk/models/vosk-model-small-ja-0.22.zip',
      'https://huggingface.co/rhasspy/vosk-models/resolve/main/ja/vosk-model-small-ja-0.22.zip',
    ],
  },
  'ko-KR': {
    code: 'ko-KR',
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    modelId: 'vosk-model-small-ko-0.22',
    estimatedSize: '42 MB',
    isBundled: false,
    downloadUrls: [
      'https://alphacephei.com/vosk/models/vosk-model-small-ko-0.22.zip',
      'https://huggingface.co/rhasspy/vosk-models/resolve/main/ko/vosk-model-small-ko-0.22.zip',
    ],
  },
  'zh-CN': {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    nativeName: '中文',
    flag: '🇨🇳',
    modelId: 'vosk-model-small-cn-0.22',
    estimatedSize: '42 MB',
    isBundled: false,
    downloadUrls: [
      'https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip',
      'https://huggingface.co/rhasspy/vosk-models/resolve/main/zh/vosk-model-small-cn-0.22.zip',
    ],
  },
  'ar-SA': {
    code: 'ar-SA',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    modelId: 'vosk-model-small-ar-0.22',
    estimatedSize: '40 MB',
    isBundled: false,
    downloadUrls: [
      'https://alphacephei.com/vosk/models/vosk-model-small-ar-0.22.zip',
      'https://huggingface.co/rhasspy/vosk-models/resolve/main/ar/vosk-model-small-ar-0.22.zip',
    ],
  },
};
