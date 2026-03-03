
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
      { id: 'create', label: 'Track Generator', sub: 'Full Song Builder', icon: Zap, action: onEnter, color: 'sky' },
      { id: 'studio', label: 'Studio Editor', sub: 'Edit & Mix', icon: Sliders, action: onOpenStudio, color: 'white' },
      { id: 'generator', label: 'Loop Generator', sub: 'Single Track Builder', icon: Music, action: onOpenGenerator, color: 'emerald' },
      { id: 'audiolab', label: 'Audio to MIDI', sub: 'Convert Audio to MIDI', icon: AudioWaveform, action: onOpenAudioLab, color: 'blue' },
      { id: 'renderer', label: 'MIDI to Audio', sub: 'Convert MIDI to WAV/MP3', icon: FileAudio, action: onOpenRenderer, color: 'fuchsia' },
      { id: 'jobs', label: 'Task List', sub: 'Background Progress', icon: ListChecks, action: onOpenJobs, color: 'orange' },
  ];

  return (
    <div className="h-full bg-black text-white overflow-y-auto pb-40 font-sans relative custom-scrollbar" dir="ltr">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] right-[-20%] w-[80vw] h-[80vw] bg-sky-900/10 rounded-full blur-[100px] opacity-30 animate-pulse"></div>
          <div className="absolute bottom-[-20%] left-[-20%] w-[80vw] h-[80vw] bg-purple-900/10 rounded-full blur-[100px] opacity-30"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center px-4 md:px-8 pt-12 max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-sky-400 mb-4">
                  MIDI AI V1.0
              </div>
              <h1 className="text-5xl md:text-8xl font-black tracking-tighter italic leading-none">
                  MIDI <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-fuchsia-500">AI</span>
              </h1>
              <p className="text-sm md:text-lg text-gray-500 font-medium max-w-2xl mx-auto">
                  Centralized command center for all AI production modules.
              </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
              {TILES.map((tile) => {
                  const Icon = tile.icon;
                  return (
                    <div 
                        key={tile.id}
                        onClick={tile.action}
                        className={`
                            group relative aspect-square bg-[#0a0a0c] border border-white/5 rounded-[2rem] p-6 flex flex-col justify-between cursor-pointer transition-all duration-300
                            hover:border-${tile.color}-500/50 hover:bg-white/[0.02] hover:scale-[1.02] hover:shadow-2xl overflow-hidden
                        `}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br from-${tile.color}-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                        <div className="relative z-10">
                            <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:bg-${tile.color}-500 group-hover:text-black transition-colors duration-300`}>
                                <Icon size={24} />
                            </div>
                            <h3 className="text-xl font-black uppercase italic tracking-tight">{tile.label}</h3>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1 group-hover:text-white/70 transition-colors">{tile.sub}</p>
                        </div>
                        <div className="relative z-10 flex justify-end">
                            <div className={`w-8 h-8 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all`}>
                                <span className="text-xs font-bold">→</span>
                            </div>
                        </div>
                    </div>
                  );
              })}
          </div>
      </div>
    </div>
  );
};
