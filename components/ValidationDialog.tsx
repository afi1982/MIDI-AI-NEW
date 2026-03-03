
import React from 'react';
import { StyleValidationResult } from '../types';

interface ValidationDialogProps {
    result: StyleValidationResult;
    onTighten: () => void;
    onSwitchGenre: () => void;
    onRegenerate: () => void;
    onIgnore: () => void;
}

const ValidationDialog: React.FC<ValidationDialogProps> = ({ result, onTighten, onSwitchGenre, onRegenerate, onIgnore }) => {
    const isStrong = result.status === 'MISMATCH';

    return (
        <div className="absolute inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in zoom-in-95 duration-200">
            <div className={`max-w-md w-full bg-[#0A0A0B] border-2 rounded-2xl p-6 shadow-2xl relative overflow-hidden ${isStrong ? 'border-red-500' : 'border-yellow-500'}`}>
                
                {/* Background Pulse */}
                <div className={`absolute inset-0 opacity-10 animate-pulse ${isStrong ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                
                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="text-4xl mb-3">{isStrong ? '🛑' : '⚠️'}</div>
                    <h2 className={`text-2xl font-black uppercase tracking-tighter mb-1 ${isStrong ? 'text-red-500' : 'text-yellow-500'}`}>
                        {isStrong ? 'Style Mismatch Detected' : 'Partial Style Drift'}
                    </h2>
                    <p className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-6">
                        Target: <span className="text-white font-bold">{result.targetGenre}</span>
                    </p>

                    <div className="w-full bg-black/40 rounded-lg p-4 mb-6 text-left border border-white/10 max-h-40 overflow-y-auto custom-scrollbar">
                        {result.issues.map((issue, idx) => (
                            <div key={idx} className="mb-3 last:mb-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${issue.severity === 'STRONG' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                                    <span className="text-[10px] font-bold text-white uppercase">{issue.type}</span>
                                </div>
                                <p className="text-[10px] text-gray-500 leading-relaxed pl-3.5">
                                    {issue.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                        {isStrong && (
                            <button 
                                onClick={onTighten}
                                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-lg transition-all shadow-lg"
                            >
                                Tighten to {result.targetGenre} (Strict)
                            </button>
                        )}
                        
                        <button 
                            onClick={onSwitchGenre}
                            className="w-full py-3 bg-studio-accent/10 border border-studio-accent/30 text-studio-accent hover:bg-studio-accent hover:text-black font-bold uppercase tracking-widest rounded-lg transition-all"
                        >
                            Switch Label to {result.suggestedGenre}
                        </button>

                        <div className="flex gap-2 mt-2">
                             <button 
                                onClick={onRegenerate}
                                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-white/10"
                            >
                                Regenerate
                            </button>
                            <button 
                                onClick={onIgnore}
                                className="flex-1 py-2 bg-transparent hover:text-white text-gray-600 text-[10px] font-bold uppercase tracking-widest"
                            >
                                Ignore Warnings
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ValidationDialog;
