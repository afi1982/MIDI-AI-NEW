
import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { MusicGenre } from '../types';
import { engineProfileService, getEngineLogTxt, getEngineStats, resolveGenreId } from '../services/engineProfileService';
import { referenceAnalysisService } from '../services/referenceAnalysisService';
import type { KnowledgeRecord } from '../services/engineProfileService';

interface ReferenceLibraryProps {
    onClose: () => void;
    onStyleAdapt?: (genre: MusicGenre, bpm: number) => void;
}

export const ReferenceLibrary: React.FC<ReferenceLibraryProps> = ({ onClose }) => {
    const [records, setRecords] = useState<KnowledgeRecord[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [qaStatus, setQaStatus] = useState<string | null>(null);
    const [stats, setStats] = useState({ total: 0, byGenre: {} as Record<string, number> });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setRecords(engineProfileService.listRecords());
        setStats(getEngineStats());
    };

    const handleDownloadLog = () => {
        const txt = getEngineLogTxt();
        const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `EMG_ENGINE_LOG_${Date.now()}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleRunQA = async () => {
        setQaStatus("⚠️ QA Service Unavailable (Deprecated)");
    };

    const handleBootstrap = () => {
        if (confirm("BOOTSTRAP EXPERT KNOWLEDGE? This will inject synthetic expert seeds to ensure core genres have high-quality baseline engine profiles.")) {
            engineProfileService.bootstrapIfEmpty(true);
            loadData();
            setQaStatus("✅ SYSTEM RE-BOOTSTRAPPED.");
        }
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setIsProcessing(true);
        
        for (const file of acceptedFiles) {
            try {
                // 1. Analyze Profile from MIDI
                const profile = await referenceAnalysisService.analyzeMidi(file);
                
                // 2. Resolve target bucket
                const detectedGenre = profile.detectedGenre || "PSYTRANCE_FULLON";
                const genreId = resolveGenreId(detectedGenre);
                
                // 3. Compute score based on complexity/density
                const score = Math.min(100, Math.round((profile.noteDensityAvg * 10) + (profile.bpmConfidence * 50)));
                
                // 4. Ingest into Engine
                await engineProfileService.ingestMidiKnowledge({
                    fileBuffer: await file.arrayBuffer(),
                    fileName: file.name,
                    genre: genreId,
                    extractedProfile: profile,
                    qualityTags: score > 70 ? ["HIGH_QUALITY"] : ["STANDARD"],
                    contributionTags: ["BASS", "MELODY", "RHYTHM"],
                    engineScore: score
                });
                
            } catch (e) {
                console.error("Ingest failed", e);
                alert(`Analysis failed for ${file.name}. Ensure it's a valid MIDI file.`);
            }
        }
        
        loadData();
        setIsProcessing(false);
    }, []);

    const handleClear = () => {
        if (confirm("CLEAR ALL ENGINE KNOWLEDGE? This will wipe your history and revert to 6 expert seeds.")) {
            engineProfileService.clearEngine();
            loadData();
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'audio/midi': ['.mid', '.midi'] }
    } as any);

    return (
        <div className="w-full h-full flex flex-col bg-[#050507] text-white font-sans animate-in slide-in-from-right-10 duration-500 overflow-hidden">
            {/* HEADER */}
            <div className="h-20 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-6 shrink-0 z-50 shadow-lg">
                <div>
                    <h1 className="text-2xl font-display font-black uppercase tracking-tighter text-white">
                        Permanent <span className="text-studio-accent">Engine</span>
                    </h1>
                    <div className="flex gap-2 items-center mt-1">
                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                            V38 Adaptive Engine Synthesis
                        </p>
                        <span className="text-[9px] text-green-500 font-mono bg-green-900/10 px-2 rounded border border-green-500/20">
                            {records.length} Units Persisted
                        </span>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleBootstrap}
                        className="px-4 py-2 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-900/20 text-xs font-bold uppercase tracking-widest transition-all"
                    >
                        Bootstrap
                    </button>
                    <button 
                        onClick={handleRunQA}
                        className="px-4 py-2 border border-purple-500/30 text-purple-400 rounded-lg hover:bg-purple-900/20 text-xs font-bold uppercase tracking-widest transition-all"
                    >
                        Validate
                    </button>
                    <button 
                        onClick={handleDownloadLog}
                        className="hidden md:flex px-4 py-2 border border-studio-accent/30 text-studio-accent rounded-lg hover:bg-studio-accent hover:text-black text-xs font-bold uppercase tracking-widest transition-all items-center gap-2"
                    >
                        Log
                    </button>
                    <button onClick={onClose} className="px-6 py-2 border border-white/10 rounded-lg hover:bg-white/5 text-xs font-bold uppercase tracking-widest transition-all">
                        Close
                    </button>
                </div>
            </div>

            {qaStatus && (
                <div className={`px-6 py-2 text-[10px] font-bold font-mono border-b border-white/10 shrink-0 ${qaStatus.includes('FAILED') ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'}`}>
                    {qaStatus}
                </div>
            )}

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                
                {/* LEFT: INGESTION & CONTROLS */}
                <div className="w-full md:w-[350px] bg-[#0E0E10] border-r border-white/5 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto custom-scrollbar">
                    
                    <div 
                        {...getRootProps()} 
                        className={`
                            border-2 border-dashed rounded-xl h-56 flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden shrink-0
                            ${isDragActive ? 'border-studio-accent bg-studio-accent/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}
                        `}
                    >
                        <input {...getInputProps()} />
                        {isProcessing ? (
                            <div className="flex flex-col items-center animate-pulse">
                                <div className="text-3xl mb-2">⚙️</div>
                                <span className="text-[10px] font-bold uppercase text-studio-accent tracking-widest text-center">Deconstructing MIDI...<br/>Extracting Blueprint</span>
                            </div>
                        ) : (
                            <>
                                <div className="text-3xl mb-3 opacity-50">📥</div>
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Add MIDI Track</p>
                                <p className="text-[9px] text-gray-600 mt-2 font-mono text-center px-4">Files are analyzed for rhythm & melody and stored in LocalStorage</p>
                            </>
                        )}
                    </div>

                    <div className="bg-black/40 rounded-xl p-5 border border-white/5">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Engine Health Dashboard</h3>
                        <div className="space-y-3">
                            {Object.entries(stats.byGenre).map(([g, count]) => (
                                <div key={g} className="space-y-1">
                                    <div className="flex justify-between text-[10px] uppercase font-bold">
                                        <span className="text-gray-400">{g.replace('_', ' ')}</span>
                                        <span className="text-white">{count}</span>
                                    </div>
                                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                        {/* Fix: Explicitly cast count to number for arithmetic operation */}
                                        <div 
                                            className="h-full bg-studio-accent transition-all duration-1000" 
                                            style={{ width: `${Math.min(100, (Number(count)/20)*100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-white/5 flex flex-col gap-3">
                        <div className="p-3 bg-studio-accent/5 border border-studio-accent/20 rounded-lg">
                            <p className="text-[9px] text-studio-accent leading-relaxed italic">
                                "The Engine observes your uploads to adjust generation density and pitch variety automatically."
                            </p>
                        </div>
                        <button onClick={handleClear} className="w-full py-3 bg-red-900/10 hover:bg-red-900/30 text-red-500 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-red-900/20 transition-all">
                            Wipe Local Engine
                        </button>
                    </div>
                </div>

                {/* RIGHT: RECORD LIST */}
                <div className="flex-1 bg-[#050507] flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-[#08080A] flex justify-between items-center shrink-0">
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Active Knowledge Base</h3>
                        <span className="text-[9px] text-gray-500 font-mono">Sorted by Relevance</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
                        {records.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600">
                                <span className="text-5xl mb-4 opacity-20">⚙️</span>
                                <p className="text-xs font-mono uppercase tracking-[0.3em]">No learned data detected</p>
                            </div>
                        ) : (
                            [...records].reverse().map((r, i) => {
                                const isSystem = r.qualityTags?.includes('SYSTEM_DEFAULT');
                                // Fix: Use any to allow arithmetic operations on potentially undefined or poorly inferred properties from storage
                                const profile = r.profile as any;
                                return (
                                <div key={r.id || i} className={`bg-[#111] border p-4 rounded-xl flex flex-col gap-3 group hover:border-studio-accent/40 transition-all ${isSystem ? 'border-blue-900/20 opacity-70' : 'border-white/5'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${isSystem ? 'bg-blue-900/20 text-blue-400' : 'bg-studio-accent/20 text-studio-accent'}`}>
                                                {r.engineScore}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-xs font-bold truncate max-w-[250px] ${isSystem ? 'text-blue-400' : 'text-white'}`}>{r.sourceFileName}</span>
                                                <div className="flex gap-2 items-center">
                                                    <span className="text-[8px] bg-white/5 px-1.5 py-0.5 rounded text-gray-400 font-mono font-bold uppercase tracking-widest">{r.genre}</span>
                                                    {isSystem && <span className="text-[7px] text-blue-500 font-black uppercase tracking-tighter">[EXPERT_SEED]</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-[8px] text-gray-600 font-mono">{new Date(r.createdAtISO).toLocaleDateString()}</span>
                                            <span className="block text-[8px] text-studio-accent font-black uppercase tracking-widest">Score: {r.engineScore}%</span>
                                        </div>
                                    </div>
                                    
                                    {/* BLUEPRINT SUMMARY REVEAL */}
                                    <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/5">
                                        <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                                            <span className="block text-[7px] text-gray-500 uppercase font-black mb-1">Density</span>
                                            {/* Fix: Ensure arithmetic on noteDensityAvg is safe with Number conversion and robust fallback for potential undefined/NaN results on line 199 area */}
                                            <span className="text-[10px] font-mono text-white">{( (Number(r.profile?.noteDensityAvg || 0)) * 16).toFixed(1)}/bar</span>
                                        </div>
                                        <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                                            <span className="block text-[7px] text-gray-500 uppercase font-black mb-1">Range</span>
                                            {/* Fix: Explicitly cast pitchRange properties to number for subtraction to avoid arithmetic type errors */}
                                            <span className="text-[10px] font-mono text-white">
                                                {r.profile?.pitchRange ? `${Number(r.profile.pitchRange.max || 0) - Number(r.profile.pitchRange.min || 0)}` : 'N/A'} ST
                                            </span>
                                        </div>
                                        <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                                            <span className="block text-[7px] text-gray-500 uppercase font-black mb-1">BPM Conf</span>
                                            {/* Fix: Explicitly cast bpmConfidence to number for safe arithmetic multiplication */}
                                            <span className="text-[10px] font-mono text-white">{Math.round(Number(r.profile?.bpmConfidence || 0) * 100)}%</span>
                                        </div>
                                        <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                                            <span className="block text-[7px] text-gray-500 uppercase font-black mb-1">Status</span>
                                            <span className="text-[8px] font-bold text-green-500 uppercase">SYNCHRONIZED</span>
                                        </div>
                                    </div>
                                    
                                    {!isSystem && (
                                        <div className="flex gap-2 mt-1">
                                            {r.contributionTags.map(tag => (
                                                <span key={tag} className="text-[7px] text-gray-500 border border-white/5 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest">Influence: {tag}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};