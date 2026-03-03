
import React, { useState, useRef, useEffect } from 'react';
import { maestroService, ELITE_16_CHANNELS, GenerationMetadata } from '../services/maestroService';
import { melodicComposer } from '../services/melodicComposer';
import { ChannelKey, NoteEvent, MusicalKey, ScaleType, GrooveObject, MusicGenre, GenreEngineProfile } from '../types';
import { ArrowLeft, Play, Download, RefreshCw, Music, Layers, Square, Cpu, ShieldCheck, Microscope, Info, ChevronRight, Activity, Fingerprint, Database } from 'lucide-react';
import { downloadChannelMidi } from '../services/midiService';
import { theoryEngine } from '../services/theoryEngine';
import { ComplexityLevel } from '../services/melodicComposer';
import { engineProfileService, resolveGenreId } from '../services/engineProfileService';
import { referenceStorageService } from '../services/referenceStorageService';
import * as Tone from 'tone';

interface SingleChannelGeneratorProps {
    onClose: () => void;
}

const createPreviewSynth = (channel: ChannelKey) => {
    const limiter = new Tone.Limiter(-3).toDestination();
    let synth: any;
    if (channel === 'ch1_kick') {
        synth = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 } }).connect(limiter);
    } else if (channel.includes('sub') || channel.includes('bass')) {
        synth = new Tone.MonoSynth({ oscillator: { type: "sawtooth" }, filter: { Q: 2, type: "lowpass", rolloff: -24 }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.2 }, filterEnvelope: { attack: 0.001, decay: 0.1, sustain: 0.2, baseFrequency: 200, octaves: 2 } }).connect(limiter);
    } else if (channel.includes('hh') || channel.includes('snare') || channel.includes('clap')) {
        synth = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.1, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).connect(limiter);
    } else {
        synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sawtooth" }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 } }).connect(limiter);
    }
    return { synth, limiter };
};

const SimplePianoRoll: React.FC<{ notes: NoteEvent[], isEngineEnhanced: boolean }> = ({ notes, isEngineEnhanced }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const totalSteps = 64; 
        const colWidth = canvas.width / totalSteps; 
        ctx.lineWidth = 1;
        for(let i=0; i<=totalSteps; i++) {
            ctx.beginPath(); 
            ctx.moveTo(i*colWidth, 0); 
            ctx.lineTo(i*colWidth, canvas.height); 
            ctx.strokeStyle = i % 16 === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.03)';
            ctx.stroke();
        }
        if (notes.length === 0) return;
        const midiValues = notes.map(n => typeof n.note === 'string' ? theoryEngine.getMidiNote(n.note) : 60);
        const minMidi = Math.min(...midiValues) - 2;
        const maxMidi = Math.max(...midiValues) + 2;
        const range = Math.max(12, maxMidi - minMidi);
        notes.forEach(n => {
            const startStep = (n.startTick || 0) / 120;
            const widthStep = (n.durationTicks || 120) / 120;
            const pitch = typeof n.note === 'string' ? theoryEngine.getMidiNote(n.note) : 60;
            const x = startStep * colWidth;
            const y = canvas.height - ((pitch - minMidi) / range) * canvas.height;
            const w = widthStep * colWidth;
            const h = (canvas.height / range) - 1;
            
            if (isEngineEnhanced) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#d946ef';
                ctx.fillStyle = '#f0abfc';
            } else {
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#10b981';
            }
            
            ctx.fillRect(x, y - h, Math.max(w - 1, 2), Math.max(h, 2));
            ctx.shadowBlur = 0;
        });
    }, [notes, isEngineEnhanced]);

    return (
        <div className="w-full bg-black border border-white/10 rounded-xl overflow-hidden h-36 md:h-48 relative shadow-inner">
            <canvas ref={canvasRef} width={800} height={200} className="w-full h-full" />
            <div className="absolute bottom-2 right-2 text-[8px] text-gray-500 font-mono bg-black/50 px-2 rounded tracking-widest">STUDIO_PREVIEW</div>
        </div>
    );
};

const getFriendlyChannelName = (key: string) => {
    if (key === 'ch3_midBass') return 'Baseline (Mid)';
    if (key === 'ch16_synth') return 'Synth FX';
    if (key === 'ch2_sub') return 'Sub Bass';
    if (key === 'ch4_leadA') return 'Lead (Hero)';
    return key.replace(/ch\d+_/, '').replace(/([A-Z])/g, ' $1').trim().toUpperCase();
};

export const SingleChannelGenerator: React.FC<SingleChannelGeneratorProps> = ({ onClose }) => {
    const [channel, setChannel] = useState<ChannelKey>('ch4_leadA');
    const [bpm, setBpm] = useState(145);
    const [key, setKey] = useState<string>("F#"); 
    const [scale, setScale] = useState<string>(ScaleType.PHRYGIAN);
    const [genre, setGenre] = useState<MusicGenre>(MusicGenre.PSYTRANCE_FULLON);
    const [complexity, setComplexity] = useState<ComplexityLevel>('COMPLEX');
    const [generatedNotes, setGeneratedNotes] = useState<NoteEvent[]>([]);
    const [genMeta, setGenMeta] = useState<GenerationMetadata | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    
    const activeSynthRef = useRef<any>(null);
    const activePartRef = useRef<Tone.Part | null>(null);
    
    const [sessionRhythmMask, setSessionRhythmMask] = useState<number[]>([]);
    const [sessionMotif, setSessionMotif] = useState<number[] | null>(null);

    const getSmartEngineProfile = (genreStr: string): GenreEngineProfile | undefined => {
        const engineData = engineProfileService.getGenreEngineProfile(resolveGenreId(genreStr));
        if (engineData && engineData.samples > 0) {
            return {
                genreTag: genreStr,
                avgLeadDensity: engineData.densityTarget / 16,
                avgBassDensity: 0.8,
                rhythmMask16: engineData.learnedParams?.rhythmTemplates?.[0] || [],
                pitchRange: { min: 60, max: 60 + engineData.melodyRangeSemitones },
                updatedAt: Date.now(),
                sampleCount: engineData.samples
            };
        }
        return referenceStorageService.getGenreEngineProfile(genreStr) || undefined;
    };

    useEffect(() => {
        const glue = Array.from({length: 16}, () => Math.random() > 0.5 ? 1 : 0);
        setSessionRhythmMask(glue);
        handleNewGeneration(glue);
        return () => { stopPlayback(); };
    }, []);

    useEffect(() => {
        if (sessionRhythmMask.length > 0) {
            handleNewGeneration(sessionRhythmMask);
        }
    }, [key, scale, genre, complexity, channel]);

    const handleGenreChange = (newGenre: MusicGenre) => {
        stopPlayback();
        setGenre(newGenre);
        setSessionMotif(null); 
        if (newGenre === MusicGenre.PSYTRANCE_FULLON) setBpm(145);
        else if (newGenre === MusicGenre.PSYTRANCE_POWER) setBpm(142);
        else if (newGenre === MusicGenre.GOA_TRANCE) setBpm(148);
        else if (newGenre === MusicGenre.MELODIC_TECHNO) setBpm(126);
        else if (newGenre === MusicGenre.TECHNO_PEAK) setBpm(132);
    };

    const stopPlayback = () => {
        try {
            Tone.Transport.stop();
            Tone.Transport.cancel(0);
            if (activePartRef.current) {
                const part = activePartRef.current;
                activePartRef.current = null;
                if (part && !part.disposed) { try { part.stop(); part.dispose(); } catch(e) {} }
            }
            if (activeSynthRef.current) {
                const { synth, limiter } = activeSynthRef.current;
                activeSynthRef.current = null;
                if (synth && !synth.disposed) { try { if (typeof synth.releaseAll === 'function') synth.releaseAll(); synth.dispose(); } catch(e) {} }
                if (limiter && !limiter.disposed) { try { limiter.dispose(); } catch(e) {} }
            }
        } catch(e) {}
        setIsPlaying(false);
    };

    const handlePlayPreview = async () => {
        if (isPlaying) { stopPlayback(); return; }
        if (generatedNotes.length === 0) return;
        await Tone.start();
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        Tone.Transport.bpm.value = bpm;
        const { synth, limiter } = createPreviewSynth(channel);
        activeSynthRef.current = { synth, limiter };
        const events = generatedNotes.map(n => ({ time: n.time, note: n.note, velocity: n.velocity }));
        activePartRef.current = new Tone.Part((time, value) => {
            try {
                const current = activeSynthRef.current;
                if (current && current.synth && !current.synth.disposed && typeof current.synth.triggerAttackRelease === 'function') { 
                    current.synth.triggerAttackRelease(value.note, "16n", time, value.velocity); 
                }
            } catch (e) {}
        }, events);
        if (activePartRef.current) { activePartRef.current.loop = true; activePartRef.current.loopEnd = "4m"; activePartRef.current.start(0); }
        Tone.Transport.start();
        setIsPlaying(true);
    };

    const handleNewGeneration = (currentMask?: number[], motifOverride?: number[]) => {
        stopPlayback();
        const mask = currentMask || sessionRhythmMask;
        let newMotif = motifOverride || sessionMotif;
        if (!newMotif) {
             const engineProfile = getSmartEngineProfile(genre);
             newMotif = melodicComposer.createMotif(16, 7, genre, engineProfile);
             setSessionMotif(newMotif);
        }
        const { notes, meta } = maestroService.generateSingle4BarLoopWithMeta(channel, bpm, key, scale, complexity, newMotif, mask, genre);
        setGeneratedNotes(notes);
        setGenMeta(meta);
    };

    const handleManualRegenerate = () => {
        const engineProfile = getSmartEngineProfile(genre);
        const newMotif = melodicComposer.createMotif(16, 7, genre, engineProfile);
        setSessionMotif(newMotif);
        handleNewGeneration(undefined, newMotif);
    };

    const isEngineEnhanced = genMeta && genMeta.enginePatternsActive > 0;

    return (
        <div className="h-full flex flex-col bg-[#050508] text-white animate-in fade-in" dir="rtl">
            <header className="h-16 md:h-20 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => { stopPlayback(); onClose(); }} className="p-2 hover:bg-white/10 rounded-full transition-all text-gray-400">
                        <ArrowLeft size={20} className="rotate-180" />
                    </button>
                    <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter">
                        Loop <span className="text-emerald-500">Generator</span>
                    </h1>
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden" dir="ltr">
                <div className="w-full md:w-80 bg-[#0E0E10] border-b md:border-b-0 md:border-r border-white/5 p-4 md:p-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar shrink-0">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Musical Style</label>
                        <select value={genre} onChange={(e) => handleGenreChange(e.target.value as MusicGenre)} className="w-full bg-black border border-emerald-500/30 rounded-lg p-3 text-sm font-bold text-white outline-none focus:border-emerald-500">
                            {Object.values(MusicGenre).map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Target Channel</label>
                        <select value={channel} onChange={(e) => { stopPlayback(); setChannel(e.target.value as ChannelKey); }} className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm font-bold text-white outline-none">
                            {ELITE_16_CHANNELS.map(ch => <option key={ch} value={ch}>{getFriendlyChannelName(ch)}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Complexity Mode</label>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => { stopPlayback(); setComplexity('SIMPLE'); }}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${complexity === 'SIMPLE' ? 'bg-emerald-600 text-white' : 'bg-black border border-white/10 text-gray-500'}`}
                            >
                                SIMPLE
                            </button>
                            <button 
                                onClick={() => { stopPlayback(); setComplexity('COMPLEX'); }}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${complexity === 'COMPLEX' ? 'bg-emerald-600 text-white' : 'bg-black border border-white/10 text-gray-500'}`}
                            >
                                COMPLEX
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Key</label>
                            <select value={key} onChange={(e) => { stopPlayback(); setKey(e.target.value); }} className="w-full bg-black border border-white/10 rounded-lg p-2 text-[10px] font-bold text-white outline-none">
                                {Object.values(MusicalKey).map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Scale</label>
                            <select value={scale} onChange={(e) => { stopPlayback(); setScale(e.target.value); }} className="w-full bg-black border border-white/10 rounded-lg p-2 text-[10px] font-bold text-white outline-none">
                                {Object.values(ScaleType).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <button onClick={handleManualRegenerate} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                        <RefreshCw size={14} /> Reroll Pattern
                    </button>
                </div>

                <div className="flex-1 bg-[#050508] p-4 md:p-10 flex flex-col items-center justify-center relative overflow-y-auto custom-scrollbar">
                    
                    {/* ENHANCED PROOF PANEL: ALWAYS VISIBLE STATUS */}
                    <div className={`w-full max-w-2xl mb-8 border rounded-[2rem] p-6 animate-in slide-in-from-top-4 duration-700 ${isEngineEnhanced ? 'bg-purple-600/10 border-purple-500/30' : 'bg-gray-900/50 border-white/5 opacity-80'}`} dir="rtl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white transition-all duration-500 ${isEngineEnhanced ? 'bg-purple-600 shadow-[0_0_25px_rgba(168,85,247,0.5)]' : 'bg-gray-800'}`}>
                                    {isEngineEnhanced ? <Fingerprint size={28} /> : <Database size={28} className="text-gray-500" />}
                                </div>
                                <div>
                                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isEngineEnhanced ? 'text-purple-400' : 'text-gray-500'}`}>
                                        {isEngineEnhanced ? 'Engine Insight' : 'Engine Status'}
                                    </div>
                                    <div className="text-sm font-bold text-white leading-tight">
                                        {isEngineEnhanced ? (
                                            <>Inspired by: <span className="text-purple-300 font-mono italic underline decoration-purple-500/30 underline-offset-4">{genMeta?.sourceFilesUsed[0]}</span></>
                                        ) : (
                                            <span className="text-gray-400">Mode: <span className="text-white">Standard</span></span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {isEngineEnhanced && (
                                <div className="text-center bg-black/40 px-5 py-2.5 rounded-2xl border border-white/5">
                                    <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">MATCH RATE</div>
                                    <div className="text-xl font-black text-purple-400">{genMeta?.fidelityConfidence}%</div>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                            <span className="text-[9px] text-gray-600 font-mono">ENGINE_V38_CAPACITY: {engineProfileService.listRecords().length} files</span>
                            <div className="flex-1 h-px bg-white/5"></div>
                            {isEngineEnhanced && <div className="flex items-center gap-1.5 text-[9px] text-green-500 font-black uppercase"><ShieldCheck size={12}/> ENGINE SYNCED</div>}
                        </div>
                    </div>

                    {generatedNotes.length > 0 ? (
                        <div className="w-full max-w-2xl space-y-6 animate-in zoom-in-95 duration-500">
                            <SimplePianoRoll notes={generatedNotes} isEngineEnhanced={isEngineEnhanced} />
                            <div className="flex flex-col sm:flex-row gap-4 w-full">
                                <button onClick={handlePlayPreview} className={`flex-1 py-5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 ${isPlaying ? 'bg-red-500 text-white' : 'bg-white text-black hover:bg-emerald-400 hover:scale-[1.02]'}`}>
                                    {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                                    {isPlaying ? "Stop Preview" : "Preview Loop"}
                                </button>
                                <button onClick={() => {
                                    const g: any = { id: `LOOP_${Date.now()}`, name: 'Loop', bpm, key, scale, totalBars: 4 };
                                    ELITE_16_CHANNELS.forEach(ch => { g[ch] = []; });
                                    g[channel] = generatedNotes;
                                    downloadChannelMidi(g as GrooveObject, channel);
                                }} className="flex-1 py-5 bg-[#111] border border-white/10 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3">
                                    <Download size={16} /> Download MIDI
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center opacity-20">
                            <Music size={64} className="mx-auto mb-4" />
                            <p className="text-sm uppercase font-black tracking-widest italic text-gray-500">Select Channel & Generate Signal</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SingleChannelGenerator;
