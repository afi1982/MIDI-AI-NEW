import React from 'react';
import { Zap, Sliders, AudioWaveform, Cpu, Music, ListChecks, FileAudio } from 'lucide-react';

interface WelcomeScreenProps {
  onEnter: () => void;
  onOpenStudio: () => void;
  onOpenJobs?: () => void;
  onOpenGenerator?: () => void;
  onOpenAudioLab?: () => void;
  onOpenRenderer?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onEnter, onOpenStudio,
  onOpenJobs, onOpenGenerator, onOpenAudioLab, onOpenRenderer
}) => {
  const TILES = [
    { id: 'create', label: 'Track Generator', sub: 'Full Song Builder', icon: Zap, action: onEnter, accent: 'text-sky-400', iconBg: 'bg-sky-500/15 border-sky-500/30' },
    { id: 'studio', label: 'Studio Editor', sub: 'Edit & Mix', icon: Sliders, action: onOpenStudio, accent: 'text-white', iconBg: 'bg-white/10 border-white/20' },
    { id: 'generator', label: 'Loop Generator', sub: 'Single Track Builder', icon: Music, action: onOpenGenerator, accent: 'text-emerald-400', iconBg: 'bg-emerald-500/15 border-emerald-500/30' },
    { id: 'audiolab', label: 'Audio to MIDI', sub: 'Convert Audio to MIDI', icon: AudioWaveform, action: onOpenAudioLab, accent: 'text-blue-400', iconBg: 'bg-blue-500/15 border-blue-500/30' },
    { id: 'renderer', label: 'MIDI to Audio', sub: 'Convert MIDI to WAV/MP3', icon: FileAudio, action: onOpenRenderer, accent: 'text-fuchsia-400', iconBg: 'bg-fuchsia-500/15 border-fuchsia-500/30' },
    { id: 'jobs', label: 'Task List', sub: 'Background Progress', icon: ListChecks, action: onOpenJobs, accent: 'text-orange-400', iconBg: 'bg-orange-500/15 border-orange-500/30' },
  ];

  return (
    <div className="h-full bg-black text-white overflow-y-auto pb-8 font-sans relative custom-scrollbar" dir="ltr">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] right-[-20%] w-[80vw] h-[80vw] bg-sky-900/10 rounded-full blur-[100px] opacity-30"></div>
        <div className="absolute bottom-[-20%] left-[-20%] w-[80vw] h-[80vw] bg-purple-900/10 rounded-full blur-[100px] opacity-30"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center px-4 pt-6 max-w-7xl mx-auto md:px-8 md:pt-12">
        <div className="text-center mb-8 space-y-3 md:mb-16 md:space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-sky-400 mb-2">
            <Cpu size={12} />
            Neurokinetic V120
          </div>
          <h1 className="text-4xl font-black tracking-tighter italic leading-none md:text-8xl">
            MIDI <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-fuchsia-500">AI</span>
          </h1>
          <p className="text-sm text-gray-500 font-medium max-w-md mx-auto md:text-lg">
            Produce, convert, and mix from your phone.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full md:grid-cols-3 lg:grid-cols-4 md:gap-4">
          {TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.id}
                onClick={tile.action}
                className="group relative min-h-[148px] bg-[#0a0a0c] border border-white/10 rounded-3xl p-4 flex flex-col justify-between text-left active:scale-[0.98] transition-transform md:min-h-[200px] md:p-6 md:rounded-[2rem]"
              >
                <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${tile.iconBg} ${tile.accent}`}>
                  <Icon size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase italic tracking-tight leading-tight md:text-xl">{tile.label}</h3>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">{tile.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
