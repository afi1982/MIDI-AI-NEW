
import React, { useState, useEffect } from 'react';
import { GenerationReportData, GrooveObject, ChannelKey, NoteEvent } from '../types';
import { Music, Download, Layers, AlertCircle, FileDown, Check, Sliders, CheckSquare, Square, Package } from 'lucide-react';
import { ELITE_16_CHANNELS } from '../services/maestroService';
import { downloadChannelMidi } from '../services/midiService';
import { zipService } from '../services/zipService';

interface ReviewDashboardProps {
    report: GenerationReportData;
    groove: GrooveObject; 
    onDownload: () => void;
    onNewSession: () => void;
    onRate: () => void; 
    onSave: () => void;
    onOpenAnalyzer: () => void; 
    onEnterStudio?: () => void;
}

const ReviewDashboard: React.FC<ReviewDashboardProps> = ({ report, groove, onDownload, onNewSession, onSave, onOpenAnalyzer, onEnterStudio }) => {
    const [selectedTracks, setSelectedTracks] = useState<Set<ChannelKey>>(new Set());
    const [isExportingSelected, setIsExportingSelected] = useState(false);

    // Get note count helper
    const getNoteCount = (key: ChannelKey): number => {
        const notes = (groove as any)[key] as NoteEvent[];
        if (!notes || !Array.isArray(notes)) return 0;
        return notes.filter(n => (n.durationTicks || 120) > 0).length;
    };

    // Auto-select all active tracks on load
    useEffect(() => {
        const active = new Set<ChannelKey>();
        ELITE_16_CHANNELS.forEach(ch => {
            if (getNoteCount(ch) > 0) active.add(ch);
        });
        setSelectedTracks(active);
    }, [groove]);

    const toggleTrack = (ch: ChannelKey) => {
        if (getNoteCount(ch) === 0) return; // Cannot select empty tracks
        const next = new Set(selectedTracks);
        if (next.has(ch)) next.delete(ch);
        else next.add(ch);
        setSelectedTracks(next);
    };

    const toggleAll = () => {
        const activeTracks = ELITE_16_CHANNELS.filter(ch => getNoteCount(ch) > 0);
        if (selectedTracks.size === activeTracks.length) {
            setSelectedTracks(new Set()); // Deselect all
        } else {
            setSelectedTracks(new Set(activeTracks)); // Select all active
        }
    };

    const handleDownloadSelected = async () => {
        if (selectedTracks.size === 0) {
            alert("Please select at least one track to download.");
            return;
        }
        
        setIsExportingSelected(true);
        try {
            await zipService.exportAll({
                groove,
                runId: `CUSTOM_${Date.now()}`,
                genre: groove.genre as string || 'Trance',
                selectedChannels: Array.from(selectedTracks),
                includeEngineLogTxt: false,
                includeQaReportJson: true,
                mode: 'DIRECT',
                fileTag: `CUSTOM_SELECTION_${selectedTracks.size}CH`
            });
        } catch (e) {
            console.error("Export failed", e);
            alert("Export failed. See console.");
        } finally {
            setIsExportingSelected(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#050507] text-white font-sans overflow-hidden animate-in fade-in duration-500">
            
            {/* HEADER */}
            <header className="shrink-0 h-auto py-4 md:h-24 border-b border-white/5 bg-[#0a0a0c] flex flex-col md:flex-row items-center justify-between px-4 md:px-12 gap-4 z-10">
                <div className="flex flex-col items-center md:items-start text-center md:text-left w-full md:w-auto">
                    <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter italic">PROJECT <span className="text-sky-500">READY</span></h1>
                    <div className="flex items-center gap-2">
                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">ID: {groove.id}</p>
                        <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-400 font-bold">{selectedTracks.size} Selected</span>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-green-500/10 border border-green-500/30 px-6 py-2 md:py-3 rounded-2xl w-full md:w-auto justify-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] md:text-xs font-black text-green-400 uppercase tracking-widest">QA PASSED: VERIFIED</span>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-y-auto p-4 md:p-10 bg-[#020617] custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* LEFT COLUMN: INFO & ACTIONS */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white/5 border border-white/5 rounded-3xl p-6 md:p-8">
                            <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Music size={14} /> Musical Blueprint</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                    <span className="text-[9px] text-gray-500 uppercase block mb-1">BPM</span>
                                    <span className="text-xl md:text-2xl font-black text-white">{groove.bpm}</span>
                                </div>
                                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                    <span className="text-[9px] text-gray-500 uppercase block mb-1">Key</span>
                                    <span className="text-xl md:text-2xl font-black text-white">{groove.key} {groove.scale}</span>
                                </div>
                            </div>
                            
                            <div className="mt-6 p-4 bg-sky-500/5 border border-sky-500/10 rounded-2xl">
                                <p className="text-[10px] text-sky-400/80 leading-relaxed italic">
                                    "Select specific channels from the list to create a custom ZIP package, or download the full project below."
                                </p>
                            </div>
                        </div>

                        {onEnterStudio && (
                            <button 
                                onClick={onEnterStudio}
                                className="w-full py-5 bg-[#111] hover:bg-[#1a1a1a] border border-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-3 group"
                            >
                                <Sliders size={16} className="text-gray-500 group-hover:text-white transition-colors" /> 
                                Open in Elite Studio
                            </button>
                        )}
                    </div>

                    {/* RIGHT COLUMN: MANIFEST (SELECTION LIST) */}
                    <div className="lg:col-span-7 bg-white/5 border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col h-[500px] md:h-[600px]">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
                                <Layers size={14} /> Channel Manifest
                            </h3>
                            <button 
                                onClick={toggleAll}
                                className="text-[9px] font-bold text-gray-400 hover:text-white uppercase tracking-widest transition-colors px-3 py-1 bg-white/5 rounded hover:bg-white/10"
                            >
                                {selectedTracks.size === ELITE_16_CHANNELS.filter(ch => getNoteCount(ch) > 0).length ? 'Unselect All' : 'Select All'}
                            </button>
                        </div>
                        
                        <div className="space-y-2 overflow-y-auto custom-scrollbar pr-2 flex-1">
                            {ELITE_16_CHANNELS.map(ch => {
                                const count = getNoteCount(ch);
                                const isActive = count > 0;
                                const isSelected = selectedTracks.has(ch);
                                
                                return (
                                    <div 
                                        key={ch} 
                                        onClick={() => isActive && toggleTrack(ch)}
                                        className={`flex justify-between items-center text-[10px] font-mono px-4 py-3 rounded-xl border transition-all cursor-pointer group ${
                                            isActive 
                                                ? (isSelected 
                                                    ? 'bg-sky-500/10 border-sky-500/40 shadow-[0_0_10px_rgba(14,165,233,0.1)]' 
                                                    : 'bg-black/40 border-white/5 hover:bg-white/5 hover:border-white/10') 
                                                : 'bg-white/5 border-transparent opacity-30 cursor-not-allowed grayscale'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            {/* CHECKBOX UI */}
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                                isActive 
                                                    ? (isSelected ? 'bg-sky-500 border-sky-500' : 'bg-transparent border-white/20 group-hover:border-white/50')
                                                    : 'border-white/10'
                                            }`}>
                                                {isSelected && <Check size={12} className="text-black stroke-[4]" />}
                                            </div>

                                            <div className="flex flex-col min-w-0">
                                                <span className={`uppercase font-bold tracking-tight truncate max-w-[150px] md:max-w-[200px] ${isActive ? (isSelected ? 'text-white' : 'text-gray-400') : 'text-gray-600'}`}>
                                                    {ch.replace(/ch\d+_/, '').replace(/([A-Z])/g, ' $1').trim()}
                                                </span>
                                                {isActive && <span className="text-[8px] text-gray-500">{count} events</span>}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            {isActive && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); downloadChannelMidi(groove, ch); }}
                                                    className="p-2 bg-white/5 hover:bg-white/20 text-gray-400 hover:text-white rounded-lg transition-all active:scale-90"
                                                    title="Download Single MIDI"
                                                >
                                                    <FileDown size={14} />
                                                </button>
                                            )}
                                            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? (isSelected ? 'bg-sky-400 shadow-[0_0_5px_rgba(56,189,248,0.8)]' : 'bg-gray-700') : 'bg-red-900'}`}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>

            {/* FOOTER ACTIONS */}
            <footer className="shrink-0 p-4 md:p-8 bg-[#0a0a0c] border-t border-white/10">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-stretch md:items-center gap-4">
                    
                    <button 
                        onClick={onNewSession} 
                        className="md:w-auto px-8 py-4 border border-white/10 text-gray-500 hover:text-white font-bold uppercase text-[10px] md:text-xs tracking-widest rounded-2xl transition-all whitespace-nowrap hover:bg-white/5"
                    >
                        New Session
                    </button>

                    <div className="flex-1 flex gap-3">
                        <button 
                            onClick={handleDownloadSelected} 
                            disabled={selectedTracks.size === 0 || isExportingSelected}
                            className={`flex-1 py-4 font-black text-[10px] md:text-xs uppercase tracking-[0.2em] rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 ${
                                selectedTracks.size > 0 
                                    ? 'bg-sky-500 text-black hover:bg-white hover:scale-[1.01] active:scale-95' 
                                    : 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                            }`}
                        >
                            {isExportingSelected ? <Layers className="animate-spin" size={16} /> : <Package size={16} />}
                            Download Selected ({selectedTracks.size})
                        </button>

                        <button 
                            onClick={onDownload} 
                            className="flex-1 py-4 bg-white text-black hover:bg-gray-200 font-black text-[10px] md:text-xs uppercase tracking-[0.2em] rounded-2xl shadow-glow transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                            <Download size={16} /> Download All (Full)
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default ReviewDashboard;
