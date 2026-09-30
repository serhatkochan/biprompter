import React from 'react';

interface AudioWaveformProps {
  isMicActive: boolean;
  isSpeaking: boolean;
  isMuted?: boolean;
  frequencyData?: number[];
  color?: string;
  size?: 'sm' | 'md';
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isMicActive,
  isSpeaking,
  isMuted = false,
  frequencyData = [0, 0, 0, 0, 0],
  color = '#111111',
  size = 'md',
}) => {
  const barWidth = size === 'sm' ? 'w-0.5' : 'w-1';
  const maxHeight = size === 'sm' ? 14 : 20;
  const minHeight = 3;

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
        isMuted
          ? 'bg-[#FDEBEC] border border-[#9F2F2D]/30'
          : isSpeaking
          ? 'bg-[#EDF3EC] border border-[#346538]/30'
          : 'bg-[#F7F6F3] border border-[#EAEAEA]'
      } transition-colors duration-200 select-none`}
      title={
        isMuted
          ? 'Mikrofon Sessizde'
          : isSpeaking
          ? 'Ses Algılanıyor (Konuşuluyor)'
          : isMicActive
          ? 'Mikrofon Hazır (Dinleniyor)'
          : 'Mikrofon Kapalı'
      }
    >
      {/* Status Dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full mr-0.5 transition-all duration-300 ${
          isMuted
            ? 'bg-[#9F2F2D]'
            : isSpeaking
            ? 'bg-[#346538] animate-pulse'
            : isMicActive
            ? 'bg-[#111111]'
            : 'bg-[#9E9E9C]'
        }`}
      />

      {/* Waveform Bars */}
      <div className="flex items-center gap-[2.5px] h-3.5">
        {frequencyData.map((freq, idx) => {
          const calculatedHeight = isMuted || !isMicActive
            ? minHeight
            : isSpeaking
            ? Math.max(minHeight, Math.round(freq * maxHeight))
            : minHeight + Math.sin(Date.now() / 300 + idx) * 1.5;

          return (
            <div
              key={idx}
              className={`${barWidth} rounded-full transition-all duration-75`}
              style={{
                height: `${calculatedHeight}px`,
                backgroundColor: isMuted ? '#9F2F2D' : isSpeaking ? '#346538' : '#787774',
                opacity: isMuted ? 0.6 : isSpeaking ? 1 : 0.6,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
