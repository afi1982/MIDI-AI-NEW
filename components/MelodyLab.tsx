
import React, { useState } from 'react';
import { GrooveObject, ChannelKey } from '../types';
import { universalMelodyService } from '../services/universalMelodyService';
import { downloadChannelMidi } from '../services/midiService';
import { exportSessionToJSON } from '../services/storageService';
import { Activity, Download, Layout, Music, Zap, Clock, ShieldCheck, Layers, Sparkles } from 'lucide-react';

interface MelodyLabProps {
  groove: GrooveObject;
  onUpdate: (updatedGroove: GrooveObject) => void;
  onClose: () => void;
}

export default function MelodyLab({ groove, onUpdate, onClose }: MelodyLabProps) {
  const [minutes, setMinutes] = useState(7);
  const [activeTrack, setActiveTrack] = useState<ChannelKey>('ch4_leadA');
  const [selectedGenre, setSelectedGenre] = useState<string>('Psytrance');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    // Engine Processing UX delay
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Standard F# Phrygian - The Master Standard
    const rootMidi = 54; 
    const scale = [0, 1, 3, 5, 7, 8, 10];

    // Determine role based on activeTrack (Main leads/acid get MAIN, arps get SUPPORT)
    const role: 'MAIN' | 'SUPPORT' = (activeTrack === 'ch4_leadA' || activeTrack === 'ch14_acid') ? 'MAIN' : 'SUPPORT';

    const fullTrack = universalMelodyService.generateTrack({
      totalMinutes: minutes,
      root: rootMidi,
      scale: scale,
      genre: selectedGenre,
      role: role
    });

    onUpdate({ ...groove, [activeTrack]: fullTrack });
    setIsGenerating(false);
  };

  return (
    <div className="h-full bg-[#050508] text-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="h-20 shrink-0 border-b border-white/5 flex justify-between items-center px-10 bg-[#0A0A0C] z-30 shadow-2xl">
        <div className="flex items-center gap-6">
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-[0.2em]"
          >
            ← Back to Studio
          </button>
          <div className="h-6 w-px bg-white/10"></div>
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-studio-accent rounded-lg flex items-center justify-center text-black font-black italic shadow-[0_0_15px_rgba(6,182,212,0.4)]">U</div>
             <h1 className="text-xl font-display font-black italic tracking-[0.2em] text-white uppercase">
               Universal <span className="text-studio-accent">Architect</span>
             </h1>
          </div>
        </div>
        
        <button 
          onClick={() => exportSessionToJSON(groove)} 
          className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase hover:bg-white/10 transition-all"
        >
          <Layout className="w-3 h-3 text-studio-accent" />
          <span>Save Blueprint</span>
        </button>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Settings Panel */}
        <aside className="w-[420px] bg-[#0A0A0C] border-r border-white/5 p-8 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
          
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-studio-accent uppercase tracking-widest flex items-center gap-2">
               <ShieldCheck className="w-3 h-3" /> Target Track
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {['ch4_leadA', 'ch14_acid', 'ch6_arpA'].map((ch) => (
                <button 
                  key={ch}
                  onClick={() => setActiveTrack(ch as ChannelKey)}
                  className={`w-full p-4 text-left rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-between group ${
                    activeTrack === ch ? 'bg-studio-accent text-black shadow-glow' : 'bg-white/5 border border-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Music className={`w-4 h-4 ${activeTrack === ch ? 'text-black' : 'text-studio-accent'}`} />
                    <span>{ch.replace('ch', 'Channel ').replace('_', ' ')}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-studio-accent uppercase tracking-widest flex items-center gap-2">
               <Sparkles className="w-3 h-3" /> Genre Profile
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {['Full-On', 'Psytrance', 'Progressive'].map((g) => (
                <button 
                  key={g}
                  onClick={() => setSelectedGenre(g)}
                  className={`p-3 text-center rounded-xl text-[9px] font-black uppercase transition-all border ${
                    selectedGenre === g ? 'bg-white text-black border-white shadow-glow' : 'bg-black/40 border-white/10 text-gray-500 hover:text-white hover:border-white/20'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-6">
            <div className="flex justify-between items-center">
               <div className="flex items-center gap-2 text-gray-400">
                  <Clock className="w-4 h-4" />
                  <label className="text-[10px] font-black uppercase tracking-widest">Length</label>
               </div>
               <span className="text-xl font-display font-black text-studio-accent">{minutes}:00</span>
            </div>
            
            <input 
                type="range" min="3" max="9" step="1" 
                value={minutes} 
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-full h-1.5 bg-black rounded-full appearance-none accent-studio-accent cursor-pointer"
            />
          </div>

          <div className="mt-auto space-y-4">
              <button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className={`w-full py-6 rounded-2xl font-black text-lg uppercase tracking-tighter transition-all shadow-2xl flex items-center justify-center gap-4 ${
                  isGenerating ? 'bg-gray-800 cursor-wait' : 'bg-white text-black hover:bg-studio-accent hover:scale-[1.01] active:scale-95'
                }`}
              >
                {isGenerating ? (
                    <>
                        <Activity className="w-5 h-5 animate-spin" />
                        <span>Synthesizing...</span>
                    </>
                ) : (
                    <>
                        <Zap className="w-5 h-5" />
                        <span>Build Narrative ⚡</span>
                    </>
                )}
              </button>
              <div className="bg-studio-accent/5 border border-studio-accent/10 p-4 rounded-xl">
                <p className="text-[9px] text-studio-accent font-bold italic text-center leading-relaxed">
                  "V15 ELITE: Dynamic {selectedGenre} deconstruction. Implementing {selectedGenre === 'Progressive' ? 'long atmospheres' : 'high-speed patterns'} with strict Legato Staircase logic."
                </p>
              </div>
          </div>
        </aside>

        {/* Visual Identity Section */}
        <section className="flex-1 bg-[#050508] flex flex-col items-center justify-center p-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-studio-accent/5 via-transparent to-transparent opacity-60"></div>
            
            <div className="max-w-2xl w-full text-center relative z-10">
                <div className="w-32 h-32 bg-black border-2 border-studio-accent/30 rounded-[48px] mx-auto mb-10 flex items-center justify-center text-7xl shadow-2xl ring-1 ring-white/5">
                    <Layers className="w-16 h-16 text-studio-accent animate-pulse" />
                </div>
                
                <h2 className="text-5xl font-display font-black text-white uppercase tracking-tighter mb-6 italic">
                    Universal <span className="text-studio-accent underline decoration-studio-accent/30 underline-offset-[12px]">Structure</span>
                </h2>
                
                <div className="grid grid-cols-2 gap-4 mb-12 text-left">
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                        <h4 className="text-[10px] font-black text-studio-accent uppercase mb-1">Time Awareness</h4>
                        <p className="text-[10px] text-gray-500 leading-relaxed">Melody evolves from simple to complex based on {minutes}m duration.</p>
                    </div>
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                        <h4 className="text-[10px] font-black text-studio-accent uppercase mb-1">Genre Precision</h4>
                        <p className="text-[10px] text-gray-500 leading-relaxed">Rhythmic patterns optimized for the "{selectedGenre}" sonic profile.</p>
                    </div>
                </div>

                <div className="flex flex-col gap-6 items-center">
                    <button 
                        onClick={() => downloadChannelMidi(groove, activeTrack)}
                        className="group px-12 py-5 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-[0.4em] hover:bg-studio-accent hover:text-black transition-all shadow-2xl flex items-center gap-4"
                    >
                        <Download className="w-4 h-4" />
                        Export {activeTrack.replace('ch', '')} Package
                    </button>
                    <span className="text-[9px] text-gray-700 font-black uppercase tracking-[0.5em]">
                        Precision Engineering • V15.1 Logic
                    </span>
                </div>
            </div>

            {/* Visual Floor Proof */}
            <div className="absolute bottom-10 left-10 right-10 h-24 border-t border-white/5 flex items-end gap-[1px] opacity-10">
                {Array.from({length: 200}).map((_,i) => (
                    <div 
                        key={i} 
                        className="flex-1 bg-studio-accent" 
                        style={{ height: `${10 + Math.random() * 90}%` }} 
                    />
                ))}
            </div>
        </section>
      </main>
    </div>
  );
}
