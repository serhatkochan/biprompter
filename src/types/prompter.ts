export type TextAlignment = 'left' | 'center' | 'right';
export type GuidanceMode = 'tracking' | 'voice-activated' | 'classic';
export type DisplayMode = 'fullscreen' | 'island' | 'studio' | 'floating';
export type AppLanguage = 'tr' | 'en' | 'es' | 'de' | 'fr' | 'pt' | 'it' | 'ru' | 'ja' | 'ko' | 'zh' | 'ar';
export type SpeechLanguage =
  | 'tr-TR'
  | 'en-US'
  | 'es-ES'
  | 'de-DE'
  | 'fr-FR'
  | 'pt-BR'
  | 'it-IT'
  | 'ru-RU'
  | 'ja-JP'
  | 'ko-KR'
  | 'zh-CN'
  | 'ar-SA';
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'white';
export type FontFamily = 'sans' | 'serif' | 'mono' | 'dyslexic';

export interface TokenizedWord {
  id: string;
  text: string;
  cleanText: string;
  startIndex: number;
  endIndex: number;
  lineBreak?: boolean;
  isCue?: boolean;
}

export interface PrompterSettings {
  // App UI & Speech Localization
  appLanguage: AppLanguage;

  // Guidance & Audio (Textream Inspired)
  guidanceMode: GuidanceMode;
  displayMode: DisplayMode;
  speechLanguage: SpeechLanguage;
  highlightColor: HighlightColor;
  micSensitivity: number;      // 0.01 to 0.3 for voice-activity detection
  isMuted: boolean;

  // Independent Speeds for Classic and Voice-Activated Modes
  classicSpeed: number;        // Speed for Classic Mode (1 - 50, default 18)
  voiceSpeed: number;          // Speed for Voice-Activated Mode (1 - 50, default 18)
  speed: number;               // General / fallback speed (default 18)
  fontSize: number;           // in pixels (e.g. 24 - 96)
  lineHeight: number;         // e.g. 1.3 - 2.2
  letterSpacing: number;      // e.g. 0 - 3px
  alignment: TextAlignment;
  mirrorH: boolean;           // Horizontal mirror (scaleX(-1))
  mirrorV: boolean;           // Vertical mirror (scaleY(-1))
  showEyeline: boolean;       // Show reading marker
  eyelinePosition: number;    // % from top (e.g. 35)
  enableCountdown: boolean;   // Show 3-2-1 before scrolling
  countdownDuration: number;  // Default 3
  textColor: string;          // Default #ffffff
  backgroundColor: string;    // Default #09090b
  marginWidth: number;        // Padding percentage (e.g. 15%)
  fontFamily: FontFamily;
  islandWidth: number;        // 360 - 720px for Island mode
  islandHeight: number;       // e.g. 165px for Island mode
  islandOpacity: number;      // 0 - 100% (legacy opacity)
  islandTransparency?: number; // 0 - 100% (transparency: higher = more transparent background/chrome)
  hideFromScreenCapture: boolean; // Windows WDA_EXCLUDEFROMCAPTURE (hide from OBS/Zoom/screen recordings)
  followCursor: boolean;      // Mouse cursor follow companion mode
  clickThrough?: boolean;     // Pass clicks through window to underlying apps
  trackingTargetWpm: number;  // Target speaking tempo for tracking mode (e.g. 110, 130, 155, 180)
  autoStart?: boolean;        // Automatically start speech tracking/scrolling upon opening prompter (default true)
}

export interface ScriptSection {
  id: string;
  title: string;
  content: string;
  updatedAt?: number;
}

export interface ScriptData {
  id: string;
  title: string;
  content: string;
  sections: ScriptSection[];
  activeSectionId?: string;
  updatedAt: number;
  tags?: string[];
  category?: string;
}

export const HIGHLIGHT_PALETTE: Record<HighlightColor, { bg: string; text: string; glow: string; label: string; ring: string }> = {
  yellow: {
    bg: 'bg-[#FBF3DB]',
    text: 'text-[#956400]',
    glow: 'ring-1 ring-[#956400]/25',
    label: 'Pastel Sarı',
    ring: 'ring-[#956400]',
  },
  green: {
    bg: 'bg-[#EDF3EC]',
    text: 'text-[#346538]',
    glow: 'ring-1 ring-[#346538]/25',
    label: 'Pastel Adaçayı',
    ring: 'ring-[#346538]',
  },
  blue: {
    bg: 'bg-[#E1F3FE]',
    text: 'text-[#1F6C9F]',
    glow: 'ring-1 ring-[#1F6C9F]/25',
    label: 'Pastel Mavi',
    ring: 'ring-[#1F6C9F]',
  },
  pink: {
    bg: 'bg-[#FDEBEC]',
    text: 'text-[#9F2F2D]',
    glow: 'ring-1 ring-[#9F2F2D]/25',
    label: 'Pastel Gül',
    ring: 'ring-[#9F2F2D]',
  },
  white: {
    bg: 'bg-white',
    text: 'text-[#111111]',
    glow: 'ring-1 ring-black/20',
    label: 'Monokrom Kontrast',
    ring: 'ring-black',
  },
};

export const DEFAULT_SETTINGS: PrompterSettings = {
  appLanguage: 'tr',
  guidanceMode: 'tracking',
  displayMode: 'island',
  speechLanguage: 'tr-TR',
  highlightColor: 'yellow',
  micSensitivity: 0.04,
  isMuted: false,

  classicSpeed: 18,
  voiceSpeed: 18,
  speed: 18,
  fontSize: 38,
  lineHeight: 1.6,
  letterSpacing: 0.5,
  alignment: 'center',
  mirrorH: false,
  mirrorV: false,
  showEyeline: true,
  eyelinePosition: 35,
  enableCountdown: true,
  countdownDuration: 3,
  textColor: '#F5F5F5',
  backgroundColor: '#111111',
  marginWidth: 8,
  fontFamily: 'sans',
  islandWidth: 540,
  islandHeight: 165,
  islandOpacity: 100,
  islandTransparency: 0,
  hideFromScreenCapture: false,
  followCursor: false,
  clickThrough: false,
  trackingTargetWpm: 130,
  autoStart: true,
};

export const DEMO_SCRIPT: ScriptData = {
  id: 'demo-script-1',
  title: 'Biprompter Konuşma Rehberi',
  activeSectionId: 'sec-1',
  sections: [
    {
      id: 'sec-1',
      title: 'Giriş ve Selamlama',
      content: `Merhaba ve Biprompter'a hoş geldiniz. [Gülümse]

Bu teleprompter; yalın tipografi, minimalist tasarım ve akıllı konuşma takibi prensipleriyle geliştirildi.`,
      updatedAt: Date.now(),
    },
    {
      id: 'sec-2',
      title: 'Akıllı Takip ve Özellikler',
      content: `Şu an Kelime Takibi modundasınız. [Nefes al] Konuştuğunuz her kelime, telaffuz ettikçe canlı olarak zarifçe vurgulanır ve metin doğal konuşma hızınıza göre otomatik olarak akar.

Eğer konuşurken metnin herhangi bir yerine atlamak isterseniz, ekrandaki istediğiniz herhangi bir kelimeye tıklamanız yeterlidir. Takip anında oraya geçecektir.`,
      updatedAt: Date.now(),
    },
    {
      id: 'sec-3',
      title: 'Kapanış',
      content: `Şimdi hazırsanız konuşmaya başlayın veya ESC tuşuna basarak editöre dönüp kendi konuşma metninizi oluşturun.`,
      updatedAt: Date.now(),
    },
  ],
  content: `Merhaba ve Biprompter'a hoş geldiniz.`,
  updatedAt: Date.now(),
};

/**
 * Convert internal speed level (1 - 50) to human-readable WPM (Words Per Minute)
 * Speed 5 = ~85 WPM (Çok Sakin)
 * Speed 10 = ~100 WPM (Sakin)
 * Speed 18 = ~130 WPM (Doğal / İdeal)
 * Speed 30 = ~160 WPM (Dinamik)
 * Speed 40 = ~190 WPM (Hızlı)
 */
export function speedToWpm(speed: number): number {
  return Math.round(70 + Math.max(1, Math.min(60, speed)) * 3);
}

export function wpmToSpeed(wpm: number): number {
  return Math.max(1, Math.min(60, Math.round((wpm - 70) / 3)));
}

export function getWpmTempoLabel(wpm: number): { label: string; emoji: string; desc: string } {
  if (wpm < 115) {
    return { label: 'Sakin', emoji: '🐢', desc: 'Resmi sunum, eğitim, tane tane anlatım' };
  } else if (wpm < 145) {
    return { label: 'Doğal', emoji: '🎯', desc: 'Standart konuşma, YouTube, podcast temposu' };
  } else if (wpm < 175) {
    return { label: 'Dinamik', emoji: '⚡', desc: 'Canlı yayın, haber, enerjik vlogger temposu' };
  } else {
    return { label: 'Hızlı', emoji: '🚀', desc: 'Reels, TikTok, hızlı tanıtım' };
  }
}

export function getActiveSpeed(settings: PrompterSettings): number {
  if (settings.guidanceMode === 'voice-activated') {
    return settings.voiceSpeed ?? settings.speed ?? 18;
  }
  return settings.classicSpeed ?? settings.speed ?? 18;
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.floor(Math.max(0, totalSeconds) % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

