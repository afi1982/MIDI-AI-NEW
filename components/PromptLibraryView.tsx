
import React from 'react';
import { GenerationParams } from '../types';

export const ELITE_PROMPT_LIBRARY = [
  { id: 1, name: "Morning Bliss", subStyle: 'Morning', text: "Generate ethereal Lydian melodies with 8-bar sustained pads and soft velocity swells." },
  { id: 2, name: "Dark Forest", subStyle: 'Dark', text: "Aggressive FM-style leads, minor-2nd intervals, and fast 1/32 jittery arps." },
  { id: 3, name: "Oldschool Goa", subStyle: 'FullOn', text: "Acid 303 squelches, resonant filter movements, and triplet-based rhythmic leads." },
  { id: 4, name: "Progressive Flow", subStyle: 'Progressive', text: "Deep rolling bass, subtle melodic evolution, and long reverb-tail pads." },
  { id: 5, name: "Full-On Power", subStyle: 'FullOn', text: "High-energy bass, complex lead layers, and syncopated percussion patterns." },
  { id: 6, name: "Deep Space", subStyle: 'Dark', text: "Minimalist lead, massive atmospheric pads, and robotic/glitchy FX noises." },
  { id: 7, name: "Vocal Support", subStyle: 'Progressive', text: "Create simple harmonic backing, mid-range pads, and non-conflicting lead riffs." },
  { id: 8, name: "High-Speed Glitch", subStyle: 'FullOn', text: "Stuttering melodic gates, randomized velocity, and ultra-fast percussion fills." },
  { id: 9, name: "Indian Spirit", subStyle: 'Morning', text: "Double Harmonic Major scale, sitar-like melodic contours, and organic percussion." },
  { id: 10, name: "Cinematic Break", subStyle: 'Morning', text: "Focus on orchestral-style pads, tension-building crescendos, and no kick/bass." }
];

interface PromptLibraryViewProps {
  currentParams: GenerationParams;
  setParams: (p: GenerationParams) => void;
  onNavigateBack: () => void;
}

const PromptLibraryView: React.FC<PromptLibraryViewProps> = ({ currentParams, setParams, onNavigateBack }) => {
  
  const handleSelect = (prompt: any) => {
    setParams({
      ...currentParams,
      // Removed mood assignment as requested
      creativeNarrative: prompt.text
    });
    // Visual feedback handled by caller/UI transition
    onNavigateBack();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050510] text-gray-200 overflow-y-auto font-rajdhani">
      <div className="sticky top-0 z-10 bg-[#050510]/95 backdrop-blur-xl border-b border-white/10 p-4 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-black italic tracking-tighter text-cyber-purple font-orbitron">ELITE PROMPT LIBRARY</h1>
            <p className="text-xs text-gray-500 tracking-widest uppercase">Inject Master Production Directives</p>
        </div>
        <button 
            onClick={onNavigateBack} 
            className="text-xs bg-white/5 border border-white/10 px-6 py-3 rounded-full hover:bg-white/10 hover:text-white uppercase font-bold tracking-widest transition-all"
        >
            Back to Studio
        </button>
      </div>

      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ELITE_PROMPT_LIBRARY.map((p) => (
            <div 
                key={p.id} 
                className="group relative p-6 bg-gradient-to-br from-[#111] to-black border border-white/10 rounded-2xl hover:border-cyber-purple/50 transition-all cursor-pointer hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] active:scale-[0.98]"
                onClick={() => handleSelect(p)}
            >
                <div className="flex justify-between items-start mb-4">
                    <span className={`text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest border border-white/10
                        ${p.subStyle === 'Dark' ? 'bg-red-900/20 text-red-400' : 
                          p.subStyle === 'Morning' ? 'bg-yellow-900/20 text-yellow-400' :
                          p.subStyle === 'Progressive' ? 'bg-blue-900/20 text-blue-400' :
                          'bg-purple-900/20 text-purple-400'
                        }
                    `}>
                        {p.subStyle}
                    </span>
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            navigator.clipboard.writeText(p.text); 
                        }}
                        className="opacity-0 group-hover:opacity-100 text-[9px] text-gray-500 hover:text-white transition-opacity uppercase font-bold"
                    >
                        Copy
                    </button>
                </div>
                <h3 className="text-lg font-bold font-orbitron mb-2 text-white group-hover:text-cyber-purple transition-colors">{p.name}</h3>
                <p className="text-xs text-gray-400 leading-relaxed font-mono border-t border-white/5 pt-2">{p.text}</p>
                
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-cyber-purple flex items-center justify-center text-black font-bold">
                        →
                    </div>
                </div>
            </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default PromptLibraryView;
