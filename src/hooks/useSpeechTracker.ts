import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { TokenizedWord, SpeechLanguage, GuidanceMode } from '../types/prompter';
import { createModel, type Model, type KaldiRecognizer } from 'vosk-browser';
import { PromptMatcher } from '../utils/PromptMatcher';

interface UseSpeechTrackerOptions {
  text: string;
  language?: SpeechLanguage;
  isActive?: boolean;
  isSpeaking?: boolean;
  speed?: number;
  guidanceMode?: GuidanceMode;
  audioContext?: AudioContext | null;
  mediaStream?: MediaStream | null;
  onComplete?: () => void;
}

import { SPEECH_MODELS } from '../utils/modelCatalog';
import { getModelBlobUrl, isModelDownloaded } from '../utils/modelStorage';

// Global cache for loaded Vosk models per language/modelId
const modelCache = new Map<string, Promise<Model>>();

export async function getVoskModelForLanguage(language: SpeechLanguage = 'tr-TR'): Promise<Model> {
  const modelInfo = SPEECH_MODELS[language] || SPEECH_MODELS['tr-TR'];
  const modelId = modelInfo.modelId;

  if (modelCache.has(modelId)) {
    return modelCache.get(modelId)!;
  }

  const loadPromise = (async () => {
    let url: string;
    if (modelInfo.isBundled) {
      url = modelInfo.bundledPath || '/models/vosk-model-small-tr-0.3.tar.gz';
    } else {
      const blobUrl = await getModelBlobUrl(modelId);
      if (!blobUrl) {
        throw new Error(`Model for ${modelInfo.nativeName} (${modelId}) is not downloaded yet.`);
      }
      url = blobUrl;
    }

    return createModel(url, -1);
  })().catch((err) => {
    modelCache.delete(modelId);
    throw err;
  });

  modelCache.set(modelId, loadPromise);
  return loadPromise;
}

export function tokenizeText(text: string): TokenizedWord[] {
  if (!text) return [];

  const result: TokenizedWord[] = [];
  // Matches either bracketed stage direction cues like [Gülümse] or [Nefes al] OR normal whitespace-delimited words
  const regex = /(\[[^\]]+\]|\S+)/g;
  let match: RegExpExecArray | null;
  let prevWordEnd = 0;

  while ((match = regex.exec(text)) !== null) {
    const rawToken = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + rawToken.length;
    const isCue = rawToken.startsWith('[') && rawToken.endsWith(']');
    const clean = isCue ? '' : PromptMatcher.foldAlnum(rawToken);

    const between = text.slice(prevWordEnd, startIndex);
    const lineBreak = prevWordEnd > 0 && between.includes('\n');

    result.push({
      id: `w-${result.length}-${startIndex}`,
      text: rawToken,
      cleanText: clean,
      startIndex,
      endIndex,
      lineBreak,
      isCue,
    });

    prevWordEnd = endIndex;
  }

  return result;
}

export function findWordIndexForCharOffset(
  words: TokenizedWord[],
  charOffset: number,
  rawOffset?: number
): number {
  if (words.length === 0) return 0;
  const targetOffset = rawOffset !== undefined ? rawOffset : charOffset;

  for (let i = 0; i < words.length; i++) {
    if (targetOffset <= words[i].endIndex) {
      // Stage direction cues are non-spoken instructions; the highlight cursor must never land on a cue.
      if (words[i].isCue) {
        // If there's a preceding spoken word, keep cursor on that spoken word
        for (let p = i - 1; p >= 0; p--) {
          if (!words[p].isCue) return p;
        }
        // If no preceding spoken word (cue at start), point to the next spoken word
        for (let n = i + 1; n < words.length; n++) {
          if (!words[n].isCue) return n;
        }
      }
      return i;
    }
  }

  // Fallback to the last non-cue word
  for (let i = words.length - 1; i >= 0; i--) {
    if (!words[i].isCue) return i;
  }

  return 0;
}

export function useSpeechTracker({
  text,
  language = 'tr-TR',
  isActive = false,
  isSpeaking = false,
  speed = 20,
  guidanceMode = 'tracking',
  audioContext = null,
  mediaStream = null,
  onComplete,
}: UseSpeechTrackerOptions) {
  // Tokenize text into words with exact character indices
  const words = useMemo<TokenizedWord[]>(() => tokenizeText(text), [text]);
  const wordsRef = useRef<TokenizedWord[]>(words);
  wordsRef.current = words;

  // Find initial first spoken word (skipping any leading cues)
  const initialWordIndex = useMemo(() => {
    const firstSpoken = words.findIndex((w) => !w.isCue);
    return firstSpoken !== -1 ? firstSpoken : 0;
  }, [words]);

  const [currentWordIndex, setCurrentWordIndex] = useState(initialWordIndex);
  const [isListening, setIsListening] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognizerRef = useRef<KaldiRecognizer | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);

  const matcherRef = useRef<PromptMatcher | null>(null);
  const lastPartialRef = useRef<string>('');
  const lastSpeechMatchTimeRef = useRef<number>(0);
  const prevIsSpeakingRef = useRef<boolean>(false);

  // Initialize / reset PromptMatcher when text changes
  useEffect(() => {
    matcherRef.current = new PromptMatcher(text);
    lastPartialRef.current = '';
    const firstSpoken = words.findIndex((w) => !w.isCue);
    setCurrentWordIndex(firstSpoken !== -1 ? firstSpoken : 0);
  }, [text, words]);

  // Jump to specific word index (Tap-to-jump)
  const jumpToWord = useCallback((index: number) => {
    const allWords = wordsRef.current;
    if (!allWords || allWords.length === 0) return;
    let target = Math.max(0, Math.min(index, allWords.length - 1));
    // If clicked on a cue, jump to the nearest spoken word instead
    if (allWords[target].isCue) {
      const nextSpoken = allWords.findIndex((w, i) => i >= target && !w.isCue);
      if (nextSpoken !== -1) {
        target = nextSpoken;
      }
    }
    const charOffset = allWords[target].startIndex;
    matcherRef.current?.jumpTo(charOffset);
    lastPartialRef.current = '';
    setCurrentWordIndex(target);
  }, []);

  const reset = useCallback(() => {
    matcherRef.current?.reset();
    lastPartialRef.current = '';
    const allWords = wordsRef.current;
    const firstSpoken = allWords.findIndex((w) => !w.isCue);
    setCurrentWordIndex(firstSpoken !== -1 ? firstSpoken : 0);
  }, []);

  // Handle Vosk partial transcript
  const handlePartialResult = useCallback(
    (partialText: string) => {
      if (!partialText || typeof partialText !== 'string') return;
      const trimmed = partialText.trim();
      if (!trimmed || trimmed === lastPartialRef.current) return;
      lastPartialRef.current = trimmed;

      const matcher = matcherRef.current;
      if (!matcher) return;

      const advanced = matcher.matchSpoken(trimmed, true);
      if (advanced) {
        lastSpeechMatchTimeRef.current = Date.now();
        const charOffset = matcher.recognizedCharCount;
        const rawOffset = matcher.rawMatchEndOffset;
        const wordIdx = findWordIndexForCharOffset(wordsRef.current, charOffset, rawOffset);
        setCurrentWordIndex(wordIdx);

        if (wordIdx >= wordsRef.current.length - 1) {
          onComplete?.();
        }
      }
    },
    [onComplete]
  );

  // Handle Vosk final result
  const handleFinalResult = useCallback(
    (finalText: string) => {
      const matcher = matcherRef.current;
      if (matcher) {
        if (finalText && typeof finalText === 'string' && finalText.trim()) {
          const advanced = matcher.matchSpoken(finalText.trim(), true);
          if (advanced) {
            lastSpeechMatchTimeRef.current = Date.now();
            const charOffset = matcher.recognizedCharCount;
            const rawOffset = matcher.rawMatchEndOffset;
            const wordIdx = findWordIndexForCharOffset(wordsRef.current, charOffset, rawOffset);
            setCurrentWordIndex(wordIdx);

            if (wordIdx >= wordsRef.current.length - 1) {
              onComplete?.();
            }
          }
        }
        matcher.restartFromCurrentProgress();
      }
      lastPartialRef.current = '';
    },
    [onComplete]
  );

  // Pre-load Vosk model when guidanceMode is 'tracking'
  useEffect(() => {
    if (guidanceMode !== 'tracking') return;

    let isMounted = true;
    setIsModelLoading(true);

    getVoskModelForLanguage(language)
      .then(() => {
        if (isMounted) {
          setIsModelReady(true);
          setIsModelLoading(false);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Vosk offline model loading failed:', err);
          setIsModelLoading(false);
          setIsModelReady(false);
          setError(err?.message || 'Model yüklenemedi');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [guidanceMode, language]);

  // Set up KaldiRecognizer and Web Audio pipeline when active in tracking mode
  useEffect(() => {
    if (
      guidanceMode !== 'tracking' ||
      !isActive ||
      !isModelReady ||
      !audioContext ||
      !mediaStream ||
      words.length === 0
    ) {
      if (processorNodeRef.current) {
        try {
          processorNodeRef.current.disconnect();
        } catch {}
        processorNodeRef.current = null;
      }
      if (silentGainRef.current) {
        try {
          silentGainRef.current.disconnect();
        } catch {}
        silentGainRef.current = null;
      }
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch {}
        sourceNodeRef.current = null;
      }
      if (recognizerRef.current) {
        try {
          recognizerRef.current.remove();
        } catch {}
        recognizerRef.current = null;
      }
      setIsListening(false);
      return;
    }

    let isCancelled = false;

    getVoskModelForLanguage(language)
      .then((model) => {
        if (isCancelled) return;

        const sampleRate = audioContext.sampleRate || 48000;
        const recognizer = new model.KaldiRecognizer(sampleRate);
        recognizerRef.current = recognizer;

        recognizer.on('partialresult', (message: any) => {
          if (message?.result?.partial) {
            handlePartialResult(message.result.partial);
          }
        });

        recognizer.on('result', (message: any) => {
          if (message?.result?.text) {
            handleFinalResult(message.result.text);
          } else {
            matcherRef.current?.restartFromCurrentProgress();
            lastPartialRef.current = '';
          }
        });

        recognizer.on('error', (err: any) => {
          console.warn('Vosk recognizer error:', err);
        });

        // Setup audio pipeline
        const source = audioContext.createMediaStreamSource(mediaStream);
        sourceNodeRef.current = source;

        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorNodeRef.current = processor;

        const silentGain = audioContext.createGain();
        silentGain.gain.value = 0;
        silentGainRef.current = silentGain;

        processor.onaudioprocess = (e) => {
          if (!recognizerRef.current) return;
          const inputData = e.inputBuffer.getChannelData(0);
          try {
            recognizerRef.current.acceptWaveformFloat(inputData, sampleRate);
          } catch {}
        };

        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(audioContext.destination);

        setIsListening(true);
      })
      .catch((err) => {
        console.warn('Recognizer initialization error:', err);
      });

    return () => {
      isCancelled = true;
      setIsListening(false);

      if (processorNodeRef.current) {
        try {
          processorNodeRef.current.disconnect();
        } catch {}
        processorNodeRef.current = null;
      }
      if (silentGainRef.current) {
        try {
          silentGainRef.current.disconnect();
        } catch {}
        silentGainRef.current = null;
      }
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch {}
        sourceNodeRef.current = null;
      }
      if (recognizerRef.current) {
        try {
          recognizerRef.current.remove();
        } catch {}
        recognizerRef.current = null;
      }
    };
  }, [
    guidanceMode,
    isActive,
    isModelReady,
    audioContext,
    mediaStream,
    words.length,
    handlePartialResult,
    handleFinalResult,
  ]);

  // Seamless pacing fallback only when in tracking mode and model is still downloading/initializing
  useEffect(() => {
    if (!isActive || words.length === 0) return;

    // Only pace if user chose tracking mode but model isn't ready yet
    const shouldPace = guidanceMode === 'tracking' && !isModelReady && isSpeaking;
    if (!shouldPace) return;

    const effectiveSpeed = speed || 20;
    const wpm = 80 + effectiveSpeed * 2.6;
    const baseIntervalMs = Math.round((60 / wpm) * 1000);

    const timer = setInterval(() => {
      const now = Date.now();
      if (now - lastSpeechMatchTimeRef.current < 750) {
        return;
      }

      setCurrentWordIndex((prev) => {
        if (prev >= words.length - 1) {
          onComplete?.();
          return prev;
        }
        return prev + 1;
      });
    }, baseIntervalMs);

    return () => clearInterval(timer);
  }, [isActive, isSpeaking, speed, guidanceMode, isModelReady, words.length, onComplete]);

  const rawProgress = words.length > 1 ? (currentWordIndex / (words.length - 1)) * 100 : 0;
  const progress = isNaN(rawProgress) ? 0 : Math.min(100, Math.max(0, rawProgress));

  return {
    words,
    currentWordIndex,
    progress,
    isListening,
    isModelLoading,
    isModelReady,
    error,
    jumpToWord,
    reset,
  };
}
