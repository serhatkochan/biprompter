import { useState, useEffect, useRef, useCallback } from 'react';

interface AudioVisualizerOptions {
  enabled?: boolean;
  sensitivity?: number; // 0.01 to 0.3
  isMuted?: boolean;
}

export interface AudioVisualizerState {
  isMicActive: boolean;
  isSpeaking: boolean;
  volumeLevel: number;
  frequencyData: number[]; // 5 frequency bands for UI waveform
  error: string | null;
  audioContext: AudioContext | null;
  mediaStream: MediaStream | null;
  startMic: () => Promise<boolean>;
  stopMic: () => void;
}

export function useAudioVisualizer({
  enabled = true,
  sensitivity = 0.04,
  isMuted = false,
}: AudioVisualizerOptions = {}): AudioVisualizerState {
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [frequencyData, setFrequencyData] = useState<number[]>([0, 0, 0, 0, 0]);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const noiseFloorRef = useRef<number>(0.005);
  const consecutiveFramesRef = useRef<number>(0);
  const activeUntilRef = useRef<number>(0);

  const stopMic = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    noiseFloorRef.current = 0.005;
    consecutiveFramesRef.current = 0;
    activeUntilRef.current = 0;
    setIsMicActive(false);
    setIsSpeaking(false);
    setVolumeLevel(0);
    setFrequencyData([0, 0, 0, 0, 0]);
  }, []);

  const startMic = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Mikrofon API tarayıcınızda desteklenmiyor.');
      }

      // Stop existing stream if any
      stopMic();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      setIsMicActive(true);

      const freqBins = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(freqBins);
      const floatData = new Float32Array(analyser.fftSize);

      const updateLoop = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        analyserRef.current.getFloatTimeDomainData(floatData);

        // Compute true physical RMS from raw float samples (-1.0 to +1.0)
        let sumSq = 0;
        for (let i = 0; i < floatData.length; i++) {
          const sample = floatData[i];
          sumSq += sample * sample;
        }
        const rms = Math.sqrt(sumSq / floatData.length);

        // Track ambient noise floor adaptively: slowly creeps up, fast to drop
        noiseFloorRef.current = Math.min(
          noiseFloorRef.current * 0.998 + rms * 0.002,
          Math.max(0.001, rms)
        );

        // 5 frequency bands for waveform animation (0..1)
        const step = Math.floor(freqBins / 5);
        const bands: number[] = [];
        for (let i = 0; i < 5; i++) {
          const val = dataArray[i * step] || 0;
          bands.push(Math.min(1, val / 255));
        }

        const now = Date.now();

        // Speech activation threshold based on user sensitivity setting (default 0.04)
        // Must be significantly above ambient noise floor
        const activationLevel = Math.max(noiseFloorRef.current * 2.2, Math.max(0.016, sensitivity * 0.7));
        const immediateLevel = activationLevel * 1.8;

        // Textream VAD consecutive frames logic:
        if (rms >= immediateLevel) {
          consecutiveFramesRef.current = 2;
          activeUntilRef.current = now + 600; // 600ms hangover
        } else if (rms >= activationLevel) {
          consecutiveFramesRef.current++;
          if (consecutiveFramesRef.current >= 2) {
            activeUntilRef.current = now + 600;
          }
        } else {
          consecutiveFramesRef.current = 0;
        }

        const speakingState = now < activeUntilRef.current;

        if (isMuted) {
          setVolumeLevel(0);
          setIsSpeaking(false);
          setFrequencyData([0, 0, 0, 0, 0]);
        } else {
          setVolumeLevel(Math.min(1, rms * 5));
          setIsSpeaking(speakingState);
          setFrequencyData(bands);
        }

        animFrameRef.current = requestAnimationFrame(updateLoop);
      };

      updateLoop();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Mikrofon izni alınamadı.';
      setError(msg);
      setIsMicActive(false);
      return false;
    }
  }, [isMuted, sensitivity, stopMic]);

  // Sync mute state on stream audio track
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopMic();
    };
  }, [stopMic]);

  return {
    isMicActive,
    isSpeaking,
    volumeLevel,
    frequencyData,
    error,
    audioContext: audioContextRef.current,
    mediaStream: streamRef.current,
    startMic,
    stopMic,
  };
}
