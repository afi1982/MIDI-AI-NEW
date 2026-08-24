import React, { useState, useRef, useEffect } from 'react';
import { maestroService, ELITE_16_CHANNELS, GenerationMetadata } from '../services/maestroService';
import { melodicComposer } from '../services/melodicComposer';
import { ChannelKey, NoteEvent, MusicalKey, ScaleType, GrooveObject, MusicGenre, GenreEngineProfile } from '../types';
import { ArrowLeft, Play, Download, RefreshCw, Square, Fingerprint, Database } from 'lucide-react';
import { downloadChannelMidi } from '../services/midiService';
import { theoryEngine } from '../services/theoryEngine';
import { ComplexityLevel } from '../services/melodicComposer';
import { engineProfileService, resolveGenreId } from '../services/engineProfileService';
import { referenceStorageService } from '../services/referenceStorageService';
import { loopPreviewPlayer } from '../services/loopPreviewPlayer';
import { inspectAndHealLoop, QualityReport } from '../services/qualityGateService';
import { QualityReportCard } from './QualityReportCard';

interface SingleChannelGeneratorProps {
    onClose: () => void;
}

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
        for (let i = 0; i <= totalSteps; i++) {
            ctx.beginPath();
            ctx.moveTo(i * colWidth, 0);
            ctx.lineTo(i * colWidth, canvas.height);
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
            ctx.fillStyle = isEngineEnhanced ? '#f0abfc' : '#10b981';
            ctx.fillRect(x, y - h, Math.max(w - 1, 2), Math.max(h, 2));
        });
    }, [notes, isEngineEnhanced]);

    return (
        <div className="w-full bg-black border border-white/10 rounded-xl overflow-hidden h-32 md:h-48 relative shadow-inner">
            <canvas ref={canvasRef} width={800} height={200} className="w-full h-full" />
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

const sourceLabel = (meta: GenerationMetadata | null) => {
    const raw = meta?.sourceFilesUsed?.[0];
    return raw && raw !== 'undefined' ? raw : 'Learned engine patterns';
};

export const SingleChannelGenerator: React.FC<SingleChannelGeneratorProps> = ({ onClose }) => {
    const [channel, setChannel] = useState<ChannelKey>('ch4_leadA');
    const [bpm, setBpm] = useState(145);
    const [key, setKey] = useState<string>('F#');
    const [scale, setScale] = useState<string>(ScaleType.PHRYGIAN);
    const [genre, setGenre] = useState<MusicGenre>(MusicGenre.PSYTRANCE_FULLON);
    const [complexity, setComplexity] = useState<ComplexityLevel>('COMPLEX');
    const [generatedNotes, setGeneratedNotes] = useState<NoteEvent[]>([]);
    const [genMeta, setGenMeta] = useState<GenerationMetadata | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loopVersion, setLoopVersion] = useState(1);
    const [audioError, setAudioError] = useState<string | null>(null);
    const [quality, setQuality] = useState<QualityReport | null>(null);

    const notesRef = useRef<NoteEvent[]>([]);
    const playingRef = useRef(false);
    const paramsRef = useRef({ channel, bpm, key, scale, genre });
    const [sessionRhythmMask, setSessionRhythmMask] = useState<number[]>([]);
    const [sessionMotif, setSessionMotif] = useState<number[] | null>(null);
    const [grooveSeed, setGrooveSeed] = useState(() => (Date.now() ^ (Math.random() * 1e9)) >>> 0);
    const grooveSeedRef = useRef(grooveSeed);

    paramsRef.current = { channel, bpm, key, scale, genre };
    grooveSeedRef.current = grooveSeed;
    notesRef.current = generatedNotes;

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

    const stopPlayback = () => {
        try { loopPreviewPlayer.stop(); } catch {}
        playingRef.current = false;
        setIsPlaying(false);
    };

    const playNotes = async (notes: NoteEvent[]) => {
        if (!notes.length) {
            setAudioError('אין תווים בלולאה. לחצו New loop.');
            return;
        }
        setAudioError(null);
        try {
            await loopPreviewPlayer.unlock();
            await loopPreviewPlayer.play(notes, paramsRef.current.bpm, paramsRef.current.channel, paramsRef.current.genre);
            playingRef.current = true;
            setIsPlaying(true);
        } catch (err: any) {
            playingRef.current = false;
            setIsPlaying(false);
            setAudioError(err?.message || 'אין סאונד. לחצו Play loop שוב.');
        }
    };

    const handlePlayPreview = async () => {
        if (playingRef.current) {
            stopPlayback();
            return;
        }
        await playNotes(notesRef.current);
    };

    const commitGenerated = (notes: NoteEvent[], meta: GenerationMetadata, ch: ChannelKey, k: string, sc: string) => {
        const gated = inspectAndHealLoop(notes, ch, k, sc);
        notesRef.current = gated.notes;
        setGeneratedNotes(gated.notes);
        setGenMeta(meta);
        setQuality(gated.report);
        setLoopVersion(v => v + 1);
        return gated.notes;
    };

    const handleNewGeneration = (currentMask?: number[], motifOverride?: number[]) => {
        const wasPlaying = playingRef.current;
        stopPlayback();
        const mask = currentMask || sessionRhythmMask;
        let newMotif = motifOverride || sessionMotif;
        if (!newMotif) {
            const engineProfile = getSmartEngineProfile(genre);
            newMotif = melodicComposer.createMotif(16, 7, genre, engineProfile);
            setSessionMotif(newMotif);
        }
        const { notes, meta } = maestroService.generateSingle4BarLoopWithMeta(channel, bpm, key, scale, complexity, newMotif, mask, genre, grooveSeedRef.current);
        const healed = commitGenerated(notes, meta, channel, key, scale);
        if (wasPlaying) void playNotes(healed);
    };

    useEffect(() => {
        let raf = 0;
        const sync = () => {
            const live = loopPreviewPlayer.isPlaying();
            if (playingRef.current !== live) {
                playingRef.current = live;
                setIsPlaying(live);
            }
            raf = requestAnimationFrame(sync);
        };
        raf = requestAnimationFrame(sync);
        return () => cancelAnimationFrame(raf);
    }, []);

    useEffect(() => {
        const glue = Array.from({ length: 16 }, () => Math.random() > 0.5 ? 1 : 0);
        setSessionRhythmMask(glue);
        const engineProfile = getSmartEngineProfile(genre);
        const motif = melodicComposer.createMotif(16, 7, genre, engineProfile);
        setSessionMotif(motif);
        const { notes, meta } = maestroService.generateSingle4BarLoopWithMeta(channel, bpm, key, scale, complexity, motif, glue, genre, grooveSeedRef.current);
        commitGenerated(notes, meta, channel, key, scale);
        return () => { stopPlayback(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGenreChange = (newGenre: MusicGenre) => {
        stopPlayback();
        setGenre(newGenre);
        setSessionMotif(null);
        const bpmNow = newGenre === MusicGenre.MELODIC_TECHNO ? 126
            : newGenre === MusicGenre.TECHNO_PEAK ? 132
            : newGenre === MusicGenre.GOA_TRANCE ? 148
            : newGenre === MusicGenre.PSYTRANCE_POWER ? 142
            : 145;
        setBpm(bpmNow);
        const engineProfile = getSmartEngineProfile(newGenre);
        const motif = melodicComposer.createMotif(16, 7, newGenre, engineProfile);
        setSessionMotif(motif);
        const nextSeed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
        setGrooveSeed(nextSeed);
        grooveSeedRef.current = nextSeed;
        const { notes, meta } = maestroService.generateSingle4BarLoopWithMeta(channel, bpmNow, key, scale, complexity, motif, sessionRhythmMask, newGenre, nextSeed);
        commitGenerated(notes, meta, channel, key, scale);
    };

    const applyParamChange = (next: { channel?: ChannelKey; key?: string; scale?: string; complexity?: ComplexityLevel }) => {
        const nextChannel = next.channel ?? channel;
        const nextKey = next.key ?? key;
        const nextScale = next.scale ?? scale;
        const nextComplexity = next.complexity ?? complexity;
        if (next.channel) { stopPlayback(); setChannel(next.channel); }
        if (next.key) { stopPlayback(); setKey(next.key); }
        if (next.scale) { stopPlayback(); setScale(next.scale); }
        if (next.complexity) { stopPlayback(); setComplexity(next.complexity); }
        const motif = sessionMotif || melodicComposer.createMotif(16, 7, genre, getSmartEngineProfile(genre));
        const { notes, meta } = maestroService.generateSingle4BarLoopWithMeta(nextChannel, bpm, nextKey, nextScale, nextComplexity, motif, sessionRhythmMask, genre, grooveSeedRef.current);
        commitGenerated(notes, meta, nextChannel, nextKey, nextScale);
    };

    const handleManualRegenerate = () => {
        const nextSeed = (Date.now() ^ (Math.random() * 1e9) ^ (grooveSeedRef.current * 1103515245)) >>> 0;
        setGrooveSeed(nextSeed);
        grooveSeedRef.current = nextSeed;
        const engineProfile = getSmartEngineProfile(genre);
        const newMotif = melodicComposer.createMotif(16, 7, genre, engineProfile);
        setSessionMotif(newMotif);
        handleNewGeneration(undefined, newMotif);
    };

    const isEngineEnhanced = !!(genMeta && genMeta.enginePatternsActive > 0);

    return (
        <div className="h-full flex flex-col bg-[#050508] text-white" dir="ltr" onPointerDown={() => { void loopPreviewPlayer.unlock(); }}>
            <header className="h-14 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-3 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <button onClick={() => { stopPlayback(); onClose(); }} className="p-2 hover:bg-white/10 rounded-full text-gray-400">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-base font-black uppercase tracking-tighter truncate">
                            Loop <span className="text-emerald-500">Generator</span>
                        </h1>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Groove {grooveSeed.toString(36).slice(-4).toUpperCase()} · {complexity} · {bpm} BPM</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-3 space-y-3 md:p-6 md:max-w-2xl md:mx-auto">
                    <SimplePianoRoll notes={generatedNotes} isEngineEnhanced={isEngineEnhanced} />

                    {audioError && (
                        <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                            {audioError}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onPointerDown={() => { loopPreviewPlayer.arm(); void loopPreviewPlayer.unlock(); }}
                            onClick={() => { loopPreviewPlayer.arm(); void handlePlayPreview(); }}
                            className={`py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 ${isPlaying ? 'bg-red-500 text-white' : 'bg-white text-black'}`}
                        >
                            {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                            {isPlaying ? 'Stop' : 'Play loop'}
                        </button>
                        <button
                            onClick={handleManualRegenerate}
                            className="py-4 bg-emerald-600 text-white font-black uppercase text-xs tracking-widest rounded-2xl flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={14} /> New loop
                        </button>
                    </div>
                    <p className="text-[11px] text-gray-400 text-center" dir="rtl">
                        New loop בונה מנגינה חדשה (קונטור + קצב + פיתוח). לא אותן שתי אופציות.
                    </p>
                    <button
                        onClick={() => {
                            const g: any = { id: `LOOP_${Date.now()}`, name: 'Loop', bpm, key, scale, totalBars: 4 };
                            ELITE_16_CHANNELS.forEach(ch => { g[ch] = []; });
                            g[channel] = generatedNotes;
                            downloadChannelMidi(g as GrooveObject, channel);
                        }}
                        className="w-full py-3 bg-[#111] border border-white/10 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                        <Download size={16} /> Download MIDI
                    </button>
                    {generatedNotes.length > 0 && (
                        <BuildReportCard
                            groove={loopAsGroove(generatedNotes, channel, bpm, key, scale, genre)}
                            tool="LOOP"
                            quality={quality || undefined}
                            extra={{ channel, complexity }}
                        />
                    )}

                    <div className={`border rounded-2xl p-3 ${isEngineEnhanced ? 'bg-purple-600/10 border-purple-500/30' : 'bg-gray-900/50 border-white/5'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isEngineEnhanced ? 'bg-purple-600' : 'bg-gray-800'}`}>
                                {isEngineEnhanced ? <Fingerprint size={18} /> : <Database size={18} className="text-gray-500" />}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase text-gray-500">
                                    {isEngineEnhanced ? 'Engine Insight' : 'Engine Status'}
                                </div>
                                <div className="text-xs font-bold truncate">
                                    {isEngineEnhanced ? `Inspired by ${sourceLabel(genMeta)}` : 'Standard mode'}
                                </div>
                            </div>
                            {isEngineEnhanced && (
                                <div className="ml-auto text-right">
                                    <div className="text-[9px] text-gray-500 uppercase">Match</div>
                                    <div className="text-sm font-black text-purple-400">{genMeta?.fidelityConfidence}%</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3 bg-[#0E0E10] border border-white/5 rounded-2xl p-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Style</label>
                            <select value={genre} onChange={(e) => handleGenreChange(e.target.value as MusicGenre)} className="w-full bg-black border border-emerald-500/30 rounded-lg p-3 text-sm font-bold text-white outline-none">
                                {Object.values(MusicGenre).map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <p className="text-[10px] text-gray-400" dir="rtl">
                                {genre === MusicGenre.GOA_TRANCE ? 'גואה — רול צפוף וליד 16.'
                                  : genre === MusicGenre.PSYTRANCE_POWER ? 'פאוור — בס קצר וקיק כבד.'
                                  : genre === MusicGenre.MELODIC_TECHNO ? 'מלודיק — לגיטו ארוך, 126 BPM.'
                                  : genre === MusicGenre.TECHNO_PEAK ? 'טכנו — אוף־ביט וליד מינימלי.'
                                  : 'פול־און — גאלופ + הוק + פאמפ.'}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Instrument</label>
                            <select value={channel} onChange={(e) => applyParamChange({ channel: e.target.value as ChannelKey })} className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm font-bold text-white outline-none">
                                {ELITE_16_CHANNELS.map(ch => <option key={ch} value={ch}>{getFriendlyChannelName(ch)}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => applyParamChange({ complexity: 'SIMPLE' })} className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold ${complexity === 'SIMPLE' ? 'bg-emerald-600 text-white' : 'bg-black border border-white/10 text-gray-500'}`}>SIMPLE</button>
                            <button onClick={() => applyParamChange({ complexity: 'COMPLEX' })} className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold ${complexity === 'COMPLEX' ? 'bg-emerald-600 text-white' : 'bg-black border border-white/10 text-gray-500'}`}>COMPLEX</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Key</label>
                                <select value={key} onChange={(e) => applyParamChange({ key: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm font-bold text-white outline-none">
                                    {Object.values(MusicalKey).map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Scale</label>
                                <select value={scale} onChange={(e) => applyParamChange({ scale: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm font-bold text-white outline-none">
                                    {Object.values(ScaleType).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SingleChannelGenerator;
