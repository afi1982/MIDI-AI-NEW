
import React from 'react';
import { ArrowRight, Cpu, Database, Music, Layers, Terminal, Activity, Anchor, Ruler } from 'lucide-react';

interface SystemArchitectureViewProps {
    onClose: () => void;
}

const SERVICE_GROUPS = [
    {
        title: "The Creators",
        icon: <Music className="text-sky-400" />,
        color: "border-sky-500/30 bg-sky-900/10",
        services: [
            { 
                name: "geminiService.ts", 
                role: "AI Composer", 
                desc: "The main engine. When you click 'Generate', it uses AI to create MIDI notes for melodies and basslines." 
            },
            { 
                name: "melodicComposer.ts", 
                role: "Melody Engine", 
                desc: "A mathematical backup. If the AI doesn't provide a result, this creates melodies using musical formulas." 
            },
            { 
                name: "maestroService.ts", 
                role: "Director", 
                desc: "Decides the structure of the track: where the drops are, when the kick starts, and the overall tempo." 
            }
        ]
    },
    {
        title: "Rules & Logic",
        icon: <Ruler className="text-purple-400" />,
        color: "border-purple-500/30 bg-purple-900/10",
        services: [
            { 
                name: "theoryEngine.ts", 
                role: "Scale Enforcer", 
                desc: "Ensures the music is in the right key. It makes sure every note fits the scale you selected." 
            },
            { 
                name: "optimizationService.ts", 
                role: "Groove Engineer", 
                desc: "Handles the 'feel' of the track. It adds human-like timing and prevents bass and kick from clashing." 
            }
        ]
    },
    {
        title: "Memory & Output",
        icon: <Database className="text-yellow-400" />,
        color: "border-yellow-500/30 bg-yellow-900/10",
        services: [
            { 
                name: "engineProfileService.ts", 
                role: "Long Term Memory", 
                desc: "Stores information from MIDI files you've uploaded to improve future generations." 
            },
            { 
                name: "audioService.ts", 
                role: "Synthesizer", 
                desc: "Turns MIDI notes into the sound you hear in the browser using virtual instruments." 
            }
        ]
    }
];

export const SystemArchitectureView: React.FC<SystemArchitectureViewProps> = ({ onClose }) => {
    return (
        <div className="h-full flex flex-col bg-[#050507] text-white font-sans animate-in slide-in-from-bottom-10">
            <div className="h-20 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-8 shrink-0 shadow-xl z-20">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                        <Layers className="text-sky-500" /> System <span className="text-sky-500">Architecture</span>
                    </h1>
                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-[0.3em]">How the music is made</p>
                </div>
                <button onClick={onClose} className="flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest transition-all">
                    Back to App <ArrowRight size={14} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar pb-32">
                <div className="max-w-6xl mx-auto space-y-12">
                    <div className="grid grid-cols-1 gap-8">
                        {SERVICE_GROUPS.map((group, idx) => (
                            <div key={idx} className="space-y-4">
                                <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-2">
                                    {group.icon}
                                    <h3 className="text-lg font-black uppercase tracking-widest text-gray-200">{group.title}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {group.services.map((service, sIdx) => (
                                        <div key={sIdx} className={`relative overflow-hidden bg-[#111] border border-white/5 rounded-xl p-5 hover:border-white/20 transition-all group hover:shadow-2xl`}>
                                            <div className={`absolute top-0 right-0 w-1 h-full ${group.color.split(' ')[0].replace('border','bg')}`}></div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <Terminal size={14} className="text-gray-600 group-hover:text-white transition-colors" />
                                                <span className="text-xs font-black font-mono text-sky-300 bg-sky-900/20 px-2 py-0.5 rounded">{service.name}</span>
                                            </div>
                                            <h4 className="text-sm font-bold text-white mb-2">{service.role}</h4>
                                            <p className="text-[11px] text-gray-400 leading-relaxed">{service.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
