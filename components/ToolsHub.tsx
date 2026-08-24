import React from 'react';
import { AudioWaveform, FileAudio, Music, ChevronRight } from 'lucide-react';

interface ToolsHubProps {
  onOpenAudioLab: () => void;
  onOpenRenderer: () => void;
  onOpenGenerator: () => void;
}

const TOOLS = [
  {
    id: 'audiolab',
    label: 'Audio to MIDI',
    sub: 'Extract a lead melody from a song',
    icon: AudioWaveform,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    actionKey: 'audio' as const,
  },
  {
    id: 'renderer',
    label: 'MIDI to Audio',
    sub: 'Render MIDI to WAV / MP3',
    icon: FileAudio,
    color: 'text-fuchsia-400',
    bg: 'bg-fuchsia-500/10 border-fuchsia-500/20',
    actionKey: 'render' as const,
  },
  {
    id: 'generator',
    label: 'Loop Generator',
    sub: 'Build a 4-bar instrument loop',
    icon: Music,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    actionKey: 'loop' as const,
  },
];

export const ToolsHub: React.FC<ToolsHubProps> = ({ onOpenAudioLab, onOpenRenderer, onOpenGenerator }) => {
  const run = (key: 'audio' | 'render' | 'loop') => {
    if (key === 'audio') onOpenAudioLab();
    if (key === 'render') onOpenRenderer();
    if (key === 'loop') onOpenGenerator();
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gradient-to-b from-[#050505] to-black px-4 pt-6 pb-8">
      <header className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-sky-400 mb-1">Convert & craft</p>
        <h2 className="text-3xl font-black italic tracking-tighter">Studio <span className="text-sky-500">Tools</span></h2>
      </header>
      <div className="space-y-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => run(tool.actionKey)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#0a0a0c] border border-white/10 text-left active:scale-[0.99] transition-transform"
            >
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${tool.bg} ${tool.color}`}>
                <Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black uppercase tracking-tight">{tool.label}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{tool.sub}</div>
              </div>
              <ChevronRight size={18} className="text-gray-600 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
