
import React, { useEffect, useRef } from 'react';
import { CheckCircle, Circle, Loader2, XCircle, AlertTriangle, Cpu, Terminal as TerminalIcon, ShieldCheck, Microscope } from 'lucide-react';
import { getEngineStats, engineProfileService } from '../services/engineProfileService';

interface GenerationOverlayProps {
  currentStep: number;
  steps: string[];
  logs: string[];
  error?: string | null;
  onClose: () => void;
  targetGenre?: string;
}

export const GenerationOverlay: React.FC<GenerationOverlayProps> = ({ currentStep, steps, logs, error, onClose, targetGenre }) => {
  const logEndRef = useRef<HTMLDivElement>(null);
  const engineStats = getEngineStats();
  
  // Get active source files for this specific genre
  const genreId = targetGenre ? targetGenre.toUpperCase().replace(/\s+/g, '_') : 'UNKNOWN';
  const engineProfile = engineProfileService.getGenreEngineProfile(genreId);
  const sourceFiles = engineProfile.lastSources?.map(s => s.file).slice(0, 5) || [];

  useEffect(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, error]);

  return (
    <div className="absolute inset-0 z-[1000] bg-[#030304]/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-10 animate-in fade-in duration-500 font-sans">
      
      <div className={`w-full max-w-5xl bg-[#09090B] border rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col md:flex-row h-[700px] transition-colors duration-500 ${error ? 'border-red-500/50' : 'border-white/10'}`}>
        
        {/* LEFT: NEURAL AUDIT & STATUS */}
        <div className="w-full md:w-1/2 p-8 md:p-12 border-r border-white/5 bg-black/40 flex flex-col">
            <div className="mb-8">
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2 italic">
                    {error ? <span className="text-red-500">SYNTHESIS HALTED</span> : <>Engine <span className="text-sky-500">Override</span></>}
                </h2>
                <div className="flex gap-2">
                    <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[9px] font-black uppercase text-gray-400">Node V114.5 Active</div>
                    <div className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase ${engineStats.total > 0 ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-gray-500/10 border-white/10 text-gray-500'}`}>
                        {engineStats.total > 0 ? 'Engine Enhanced' : 'Generic Engine'}
                    </div>
                </div>
            </div>

            {/* THE PROOF PANEL: SOURCE FILES */}
            <div className="bg-purple-600/10 border border-purple-500/40 rounded-2xl p-6 mb-8 animate-in slide-in-from-left duration-700">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center text-white shadow-glow">
                        <Microscope size={24} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Engine Source Audit</div>
                        <div className="text-lg font-black text-white">{engineStats.total} Patterns in Engine</div>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <div className="text-[9px] font-bold text-gray-500 uppercase mb-2">קבצים משפיעים מהספרייה שלך:</div>
                    {sourceFiles.length > 0 ? (
                        sourceFiles.map((file, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] text-gray-300 font-mono bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                                <ShieldCheck size={10} className="text-green-500" />
                                <span className="truncate">{file}</span>
                            </div>
                        ))
                    ) : (
                        <div className="text-[10px] text-gray-600 italic">לא נמצאו קבצי מקור לז'אנר זה. משתמש בברירת מחדל.</div>
                    )}
                </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto custom-scrollbar pr-4">
                {steps.map((label, idx) => {
                    const isActive = idx === currentStep;
                    const isDone = idx < currentStep;
                    const isFailed = error && isActive;
                    
                    return (
                        <div key={idx} className={`flex items-center gap-4 transition-all duration-500 ${isActive ? 'translate-x-2' : 'opacity-30'}`}>
                            <div className={`p-2.5 rounded-lg border ${
                                isFailed ? 'bg-red-900/20 border-red-500 text-red-500' :
                                isActive ? 'bg-sky-500/10 border-sky-500 text-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.2)]' : 
                                isDone ? 'bg-green-500/10 border-green-500/30 text-green-500' : 
                                'bg-zinc-900 border-white/5 text-zinc-700'
                            }`}>
                                {isFailed ? <AlertTriangle size={16} /> : isDone ? <CheckCircle size={16} /> : isActive ? <Loader2 size={16} className="animate-spin" /> : <Circle size={16} />}
                            </div>
                            <h3 className={`text-[11px] font-black uppercase tracking-wider ${isFailed ? 'text-red-400' : isActive ? 'text-white' : isDone ? 'text-gray-300' : 'text-zinc-600'}`}>
                                {label}
                            </h3>
                        </div>
                    );
                })}
            </div>

            {error && (
                <button onClick={onClose} className="mt-8 w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95">
                    <XCircle className="w-5 h-5" /> Back to Generator
                </button>
            )}
        </div>

        {/* RIGHT: LIVE TERMINAL LOGS */}
        <div className="w-full md:w-1/2 bg-[#020203] flex flex-col font-mono text-[10px] dir-ltr border-l border-white/5">
            <div className={`h-12 border-b flex items-center px-6 justify-between ${error ? 'bg-red-950/30 border-red-500/30' : 'bg-[#0E0E10] border-white/10'}`}>
                <div className="flex items-center gap-2">
                    <TerminalIcon size={14} className="text-gray-600" />
                    <span className="text-gray-500 uppercase tracking-[0.2em] font-bold">Synthesis_Audit.log</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                    <span className="text-sky-500 uppercase font-black tracking-widest">Live Audit</span>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar bg-black/60">
                {logs.map((log, i) => (
                    <div key={i} className="flex gap-4 animate-in slide-in-from-left-2 duration-300">
                        <span className="text-zinc-800 shrink-0">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                        <span className={`
                            ${log.includes('[ENGINE]') || log.includes('ENGINE') ? 'text-purple-400 font-black' : 
                              log.includes('VERIFIED') || log.includes('OK') ? 'text-green-400' : 
                              log.includes('CRITICAL') || log.includes('ERR') ? 'text-red-400' : 
                              'text-gray-500'}
                        `}>
                            {log}
                        </span>
                    </div>
                ))}
                <div ref={logEndRef} />
            </div>
        </div>
      </div>
    </div>
  );
};
