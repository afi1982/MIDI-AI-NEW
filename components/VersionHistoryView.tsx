
import React from 'react';
import { HistorySnapshot, GrooveObject } from '../types';

interface VersionHistoryViewProps {
  history: HistorySnapshot[];
  onRestore: (snapshot: GrooveObject) => void;
}

const VersionHistoryView: React.FC<VersionHistoryViewProps> = ({ history, onRestore }) => {
  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in pb-12">
      <div className="bg-gradient-to-r from-gray-900 to-studio-surface border border-white/10 rounded-xl p-4 md:p-6 shadow-xl">
        <h2 className="text-xl font-orbitron font-bold text-white uppercase tracking-widest mb-1">Version Archive</h2>
        <p className="text-xs text-studio-dim font-mono uppercase tracking-wider">
          Forensic recovery system for generated Master Arrangements.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {history.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-2xl">
            <p className="text-studio-dim font-mono text-sm uppercase">Archive Empty</p>
            <p className="text-studio-dim text-[10px] mt-2 uppercase tracking-widest">Generate a master sequence to begin archiving versions.</p>
          </div>
        ) : (
          [...history].reverse().map((snapshot, index) => (
            <div 
              key={snapshot.id}
              className="bg-studio-panel border border-white/5 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-studio-accent/30 transition-all group"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-studio-accent/10 text-studio-accent text-[9px] font-bold rounded uppercase tracking-tighter">
                        {index === 0 ? 'Latest State' : `Archive REV-${history.length - index}`}
                    </span>
                    <h3 className="text-sm font-bold text-white font-orbitron">{snapshot.label}</h3>
                </div>
                <div className="flex gap-4 text-[9px] text-studio-dim font-tech font-bold uppercase tracking-widest mt-1">
                    <span>{new Date(snapshot.timestamp).toLocaleString()}</span>
                    <span>•</span>
                    <span>{snapshot.payload.bpm} BPM</span>
                    <span>•</span>
                    <span>{snapshot.payload.key} {snapshot.payload.scale}</span>
                </div>
              </div>

              <button 
                onClick={() => onRestore(snapshot.payload)}
                className="w-full md:w-auto px-6 py-2 bg-studio-accent/10 border border-studio-accent/30 text-studio-accent hover:bg-studio-accent hover:text-black font-bold text-[10px] uppercase tracking-widest rounded-lg transition-all"
              >
                Restore This Version
              </button>
            </div>
          ))
        )}
      </div>
      
      <div className="mt-8 p-4 bg-red-900/5 border border-red-900/20 rounded-xl">
          <p className="text-[10px] text-red-400 font-mono uppercase leading-relaxed">
             <span className="font-bold">Note:</span> Restoring a version replaces your current active studio session. 
             If you have unsaved changes, they will be archived before the restore completes.
          </p>
      </div>
    </div>
  );
};

export default VersionHistoryView;
