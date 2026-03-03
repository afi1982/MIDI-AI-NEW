
import React, { useState, useEffect } from 'react';
import { getLibrary, deleteFromLibrary, LibraryItem, clearLibrary } from '../services/storageService';
import { downloadFullProjectMidi, downloadAnalyzedMidi } from '../services/midiService';
import { downloadStudioCode } from '../services/sourceCodeService';

interface LibraryViewProps {
  onLoadProject: (item: LibraryItem) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ onLoadProject }) => {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'GENERATED' | 'ANALYZED'>('ALL');

  useEffect(() => {
    setItems(getLibrary());
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems(deleteFromLibrary(id));
  };

  const handleDownload = (item: LibraryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'GENERATED' && item.data.groove) {
      // Fix: Call downloadFullProjectMidi with 1 argument as per its definition
      downloadFullProjectMidi(item.data.groove);
    } else if (item.type === 'ANALYZED' && item.data.segments) {
      // Fix: Call downloadAnalyzedMidi with 1 argument as per its definition
      downloadAnalyzedMidi(item.data.segments);
    }
  };

  const filteredItems = items.filter(i => filter === 'ALL' || i.type === filter);

  return (
    <div className="h-full flex flex-col gap-4 md:gap-6 animate-in fade-in pb-12">
      <div className="bg-gradient-to-r from-gray-900 to-cyber-dark border border-white/10 rounded-xl p-4 md:p-6 shadow-xl">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-lg md:text-xl font-orbitron font-bold text-white uppercase tracking-widest mb-1">Library</h2>
                <p className="text-xs text-gray-400 font-mono">
                    Auto-saved history of sessions.
                </p>
            </div>
            <button 
                onClick={downloadStudioCode}
                className="bg-gray-800 hover:bg-white/10 text-gray-400 hover:text-white px-3 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest border border-white/10 transition-all flex items-center gap-2"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                QA Code
            </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        {['ALL', 'GENERATED', 'ANALYZED'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`
              px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border whitespace-nowrap
              ${filter === f 
                ? 'bg-cyber-neon text-black border-cyber-neon shadow-[0_0_10px_rgba(0,243,255,0.3)]' 
                : 'bg-black/40 text-gray-500 border-white/5 hover:bg-white/5 hover:text-white'
              }
            `}
          >
            {f}
          </button>
        ))}
        {items.length > 0 && (
            <button onClick={() => { clearLibrary(); setItems([]); }} className="ml-auto text-[9px] text-red-500 hover:text-red-400 font-bold uppercase tracking-widest whitespace-nowrap px-2">
                Clear
            </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-2xl">
            <p className="text-gray-600 font-mono text-sm uppercase">Library Empty</p>
            <p className="text-gray-700 text-xs mt-2">Generate a track or analyze audio to populate.</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <div 
              key={item.id}
              onClick={() => onLoadProject(item)}
              className="bg-black/40 border border-white/10 hover:border-cyber-neon/50 rounded-xl p-4 cursor-pointer group transition-all hover:bg-white/5 relative overflow-hidden active:scale-[0.99] active:bg-white/10"
            >
              <div className={`absolute top-0 right-0 p-1.5 rounded-bl-lg text-[8px] font-bold uppercase tracking-widest border-b border-l border-white/5 ${item.type === 'GENERATED' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                {item.type}
              </div>

              <h3 className="text-sm font-bold text-white font-orbitron mb-1 truncate pr-16">{item.name || 'Untitled Project'}</h3>
              <p className="text-[10px] text-gray-500 font-mono mb-4">
                {new Date(item.date).toLocaleDateString()} • {new Date(item.date).toLocaleTimeString()}
              </p>

              <div className="flex gap-2 mt-auto">
                 <button 
                    onClick={(e) => handleDownload(item, e)}
                    className="flex-1 bg-white/5 hover:bg-cyber-neon hover:text-black text-gray-300 text-[9px] font-bold py-2 rounded uppercase tracking-widest transition-colors border border-white/5"
                 >
                    Download
                 </button>
                 <button 
                    onClick={(e) => handleDelete(item.id, e)}
                    className="w-10 flex items-center justify-center bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-gray-600 rounded transition-colors border border-white/5"
                 >
                    &times;
                 </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
