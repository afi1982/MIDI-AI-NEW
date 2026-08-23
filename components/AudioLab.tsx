
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { jobQueueService, Job } from '../services/jobQueueService';
import { downloadFullArrangementMidi } from '../services/midiService';
import { AudioWaveform, ArrowLeft, Loader2, Play, Pause, Download, Microscope, ShieldCheck, Zap, RefreshCw, Star, Layers, Settings2, Clock } from 'lucide-react';
import { GrooveObject, NoteEvent, MusicGenre, MusicalKey, ScaleType } from '../types';
import { ELITE_16_CHANNELS } from '../services/maestroService';
import { theoryEngine } from '../services/theoryEngine';
import { SourceExportButton } from './SourceExportButton';
import { describeAudioPickError, openNativeFilePicker, ALL_FILES_ACCEPT, SONG_ACCEPT } from '../services/audioFilePicker';
import { QualityReportCard } from './QualityReportCard';

interface AudioLabProps {
    onClose: () => void;
}

const LabPianoRoll: React.FC<{ groove: GrooveObject, progress: number }> = ({ groove, progress }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const key = groove.key || "C";
        const scale = groove.scale || "Minor";
        
        ctx.fillStyle = '#050507';
        ctx.fillRect(0, 0, w, h);

        const totalBars = groove.totalBars || 32; 
        const totalTicks = totalBars * 1920;
        const steps = totalBars * 16;

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i <= steps; i++) {
            const x = (i / steps) * w;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }

        const minPitch = 24, maxPitch = 96; 
        const noteHeight = h / (maxPitch - minPitch);

        ELITE_16_CHANNELS.forEach((ch) => {
            const notes = (groove as any)[ch] as NoteEvent[];
            if (!notes) return;
            notes.forEach(n => {
                const midi = theoryEngine.getMidiNote(typeof n.note === 'string' ? n.note : n.note[0]);
                const isInScale = theoryEngine.isNoteInScale(typeof n.note === 'string' ? n.note : n.note[0], key, scale);
                
                const alpha = Math.max(0.3, n.velocity || 0.8);
                ctx.fillStyle = isInScale ? `rgba(14, 165, 233, ${alpha})` : `rgba(245, 158, 11, ${alpha})`;
                
                const x = ((n.startTick || 0) / totalTicks) * w;
                const y = h - ((midi - minPitch) * noteHeight);
                const noteWidth = Math.max(2, ((n.durationTicks || 120) / totalTicks) * w);
                
                ctx.fillRect(x, y, noteWidth, noteHeight - 1);
                
                // V116: Visualizing Microtonal Pitch Bend
                if (n.pitchBend && Math.abs(n.pitchBend) > 100) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    // Map -8192..8191 to a pixel offset within the note
                    const bendOffset = (n.pitchBend / 8192) * noteHeight;
                    ctx.moveTo(x, y + noteHeight/2);
                    ctx.lineTo(x + noteWidth, y + noteHeight/2 - bendOffset);
                    ctx.stroke();
                }
            });
        });

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(progress * w, 0); ctx.lineTo(progress * w, h); ctx.stroke();
    }, [groove, progress]);

    return (
        <div className="w-full h-full bg-[#050505] rounded-xl overflow-hidden border border-white/10 relative shadow-inner">
            <canvas ref={canvasRef} width={1200} height={400} className="w-full h-full object-fill" />
            <div className="absolute top-3 left-3 flex gap-2 bg-black/70 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full" /><span className="text-[10px] font-bold">Scale Sync</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 bg-amber-500 rounded-full" /><span className="text-[10px] font-bold">Acoustic Signal</span></div>
                <div className="h-3 w-[1px] bg-white/10 mx-1" />
                <div className="flex items-center gap-2 text-sky-400"><Star size={10} /><span className="text-[10px] font-black uppercase">16-channel trance map</span></div>
            </div>
        </div>
    );
};

export const AudioLab: React.FC<AudioLabProps> = ({ onClose }) => {
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [activeJob, setActiveJob] = useState<Job | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [manualBpm, setManualBpm] = useState<number>(145);
    const [autoBpm, setAutoBpm] = useState(true);
    const [showSettings, setShowSettings] = useState(true);
    const [pickError, setPickError] = useState<string | null>(null);
    const [genre, setGenre] = useState<MusicGenre>(MusicGenre.PSYTRANCE_FULLON);
    const [keyName, setKeyName] = useState<string>(MusicalKey.F_SHARP);
    const [scaleName, setScaleName] = useState<string>(ScaleType.PHRYGIAN);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // If no active job ID, look for the most recent AUDIO_REGRESSION job that isn't completed or failed
        if (!activeJobId) {
            const existingJobs = jobQueueService.getJobs();
            const audioJob = existingJobs.find(j => j.type === 'AUDIO_REGRESSION' && (j.status === 'PROCESSING' || j.status === 'PENDING'));
            if (audioJob) setActiveJobId(audioJob.id);
        }

        if (!activeJobId) return;
        return jobQueueService.subscribe(jobs => {
            const job = jobs.find(j => j.id === activeJobId);
            if (job) setActiveJob(job);
        });
    }, [activeJobId]);

    const startAudioJob = useCallback((file: File) => {
        const error = describeAudioPickError(file);
        if (error) {
            setPickError(error);
            return;
        }
        setPickError(null);
        setAudioUrl(URL.createObjectURL(file));
        const overrideBpm = !autoBpm && manualBpm > 20 ? manualBpm : undefined;
        setActiveJobId(jobQueueService.addAudioJob(file, overrideBpm, { genre, key: keyName, scale: scaleName }));
    }, [autoBpm, manualBpm, genre, keyName, scaleName]);

    const onDrop = useCallback((files: File[]) => {
        if (files.length === 0) return;
        startAudioJob(files[0]);
    }, [startAudioJob]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxFiles: 1,
        multiple: false,
        disabled: !!activeJobId,
        useFsAccessApi: false,
        noClick: true,
        noKeyboard: true,
    } as any);

    const pickAllFiles = () => openNativeFilePicker(ALL_FILES_ACCEPT, startAudioJob);
    const pickSongsOnly = () => openNativeFilePicker(SONG_ACCEPT, startAudioJob);

    useEffect(() => {
        if (!isPlaying) return;
        const interval = setInterval(() => {
            if (audioRef.current) setProgress(audioRef.current.currentTime / audioRef.current.duration);
        }, 30);
        return () => clearInterval(interval);
    }, [isPlaying]);

    return (
        <div className="h-full flex flex-col bg-[#050508] text-white animate-in fade-in" dir="ltr">
            {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />}
            <header className="h-16 md:h-20 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-3 md:px-8 shrink-0 gap-2">
                <div className="flex items-center gap-2 md:gap-4 min-w-0">
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full shrink-0"><ArrowLeft size={20} /></button>
                    <div className="flex flex-col min-w-0">
                        <h1 className="text-base md:text-2xl font-black uppercase tracking-tighter italic leading-none truncate">Audio to <span className="text-blue-500">MIDI</span></h1>
                        <p className="hidden sm:block text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">Convert Audio Files to MIDI V117</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3 shrink-0">
                    <button 
                        onClick={() => setShowSettings(!showSettings)} 
                        className={`p-2 rounded-lg transition-all ${showSettings ? 'bg-blue-500 text-white shadow-glow' : 'bg-white/5 text-gray-400'}`}
                        title="Analysis Settings"
                    >
                        <Settings2 size={18} />
                    </button>
                    <div className="hidden md:block">
                        <SourceExportButton pageKey="AUDIO_LAB" label="Acoustic Logic" />
                    </div>
                    {activeJob?.status === 'COMPLETED' && (
                        <button onClick={() => downloadFullArrangementMidi(activeJob.result)} className="px-3 md:px-6 py-2 md:py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold flex items-center gap-2 shadow-glow transition-all active:scale-95 text-xs md:text-sm"><Download size={16} /> <span className="hidden sm:inline">Export</span></button>
                    )}
                </div>
            </header>

            {showSettings && !activeJobId && (
                <div className="bg-[#0A0A0B] border-b border-white/5 p-3 md:px-8 animate-in slide-in-from-top-2">
                    <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-2">
                        <label className="bg-black/40 p-3 rounded-xl border border-white/5">
                            <span className="text-[8px] font-black text-gray-500 uppercase">Style</span>
                            <select value={genre} onChange={(e) => setGenre(e.target.value as MusicGenre)} className="w-full bg-transparent text-white text-xs font-bold outline-none mt-1">
                                {Object.values(MusicGenre).map((g) => <option key={g} value={g} className="bg-black">{g}</option>)}
                            </select>
                        </label>
                        <label className="bg-black/40 p-3 rounded-xl border border-white/5">
                            <span className="text-[8px] font-black text-gray-500 uppercase">BPM</span>
                            <div className="flex items-center gap-2 mt-1">
                                <button type="button" onClick={() => setAutoBpm(!autoBpm)} className={`text-[9px] font-black px-2 py-1 rounded ${autoBpm ? 'bg-blue-600' : 'bg-white/10'}`}>AUTO</button>
                                <input type="number" value={manualBpm} disabled={autoBpm} onChange={(e) => { setAutoBpm(false); setManualBpm(parseInt(e.target.value) || 145); }} className="bg-transparent outline-none text-white font-bold w-16 text-sm disabled:opacity-40" />
                            </div>
                        </label>
                        <label className="bg-black/40 p-3 rounded-xl border border-white/5">
                            <span className="text-[8px] font-black text-gray-500 uppercase">Key</span>
                            <select value={keyName} onChange={(e) => setKeyName(e.target.value)} className="w-full bg-transparent text-white text-xs font-bold outline-none mt-1">
                                {Object.values(MusicalKey).map((k) => <option key={k} value={k} className="bg-black">{k}</option>)}
                            </select>
                        </label>
                        <label className="bg-black/40 p-3 rounded-xl border border-white/5">
                            <span className="text-[8px] font-black text-gray-500 uppercase">Scale</span>
                            <select value={scaleName} onChange={(e) => setScaleName(e.target.value)} className="w-full bg-transparent text-white text-xs font-bold outline-none mt-1">
                                {Object.values(ScaleType).map((s) => <option key={s} value={s} className="bg-black">{s}</option>)}
                            </select>
                        </label>
                    </div>
                </div>
            )}

            <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
                {!activeJob ? (
                    <div className="max-w-4xl mx-auto space-y-8">
                        <div {...getRootProps()} className={`w-full min-h-[220px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center bg-[#0A0A0C] px-4 py-8 ${isDragActive ? 'border-blue-500 bg-blue-500/5' : 'border-white/10'}`}>
                            <input {...getInputProps()} />
                            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 border border-blue-500/20">
                                <AudioWaveform size={32} className={isDragActive ? 'text-blue-400 animate-pulse' : 'text-gray-500'} />
                            </div>
                            <h3 className="text-lg font-black uppercase tracking-widest text-white italic text-center">Audio to MIDI</h3>
                            <p className="text-sm text-gray-200 font-medium mt-3 text-center max-w-sm" dir="rtl">
                                בחרו שיר (MP3 / WAV / M4A). לא קובץ MIDI.
                            </p>
                            <p className="text-[11px] text-amber-200/90 mt-2 text-center max-w-xs leading-relaxed" dir="rtl">
                                בסמסונג: אם מסומן «אודיו» תראו רק .mid. לחצו «מסמך» למעלה, או השתמשו בכפתור «כל הקבצים».
                            </p>
                            <div className="mt-5 flex flex-col sm:flex-row gap-2 w-full max-w-sm">
                                <button type="button" onClick={pickAllFiles} className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white text-xs font-black uppercase active:scale-95">
                                    כל הקבצים בתיקייה
                                </button>
                                <button type="button" onClick={pickSongsOnly} className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-white text-xs font-black uppercase active:scale-95">
                                    רק MP3 / M4A / WAV
                                </button>
                            </div>
                            {pickError && (
                                <p className="mt-4 text-sm text-amber-400 text-center max-w-sm font-bold" dir="rtl">{pickError}</p>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/5 border border-white/5 p-5 rounded-3xl">
                                <Layers className="text-blue-500 mb-3" size={20} />
                                <h4 className="text-xs font-black uppercase mb-2">כל 16 הערוצים</h4>
                                <p className="text-[10px] text-gray-500 leading-relaxed">Kick, Bass, Hats, Acid, Pad ו-FX נבנים יחד. המלודיה הראשית מובילה.</p>
                            </div>
                            <div className="bg-white/5 border border-white/5 p-5 rounded-3xl">
                                <Zap className="text-amber-500 mb-3" size={20} />
                                <h4 className="text-xs font-black uppercase mb-2">טראנס לפי הסגנון</h4>
                                <p className="text-[10px] text-gray-500 leading-relaxed">השיר מנותח, ואז מסודר לפי הסגנון וה-BPM שבחרתם באתר.</p>
                            </div>
                            <div className="bg-white/5 border border-white/5 p-5 rounded-3xl">
                                <ShieldCheck className="text-green-500 mb-3" size={20} />
                                <h4 className="text-xs font-black uppercase mb-2">מלודיה מורכבת</h4>
                                <p className="text-[10px] text-gray-500 leading-relaxed">הקו הראשי מתפתח ב-drop עם וריאציות, לא קו יחיד שטוח.</p>
                            </div>
                        </div>
                    </div>
                ) : activeJob.status === 'PROCESSING' ? (
                    <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center space-y-8">
                        <div className="relative">
                            <div className="w-32 h-32 rounded-full border-4 border-white/5 border-t-blue-500 animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Microscope size={40} className="text-blue-500 animate-pulse" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black uppercase italic tracking-tight text-white">{activeJob.progress}% Processing Audio</h2>
                            <p className="text-blue-400 font-mono text-[10px] uppercase tracking-[0.2em] mt-2">
                                {activeJob.progress < 15 ? "Decoding Audio Signal..." : 
                                 activeJob.progress < 30 ? "Slicing Acoustic Source..." : 
                                 "Extracting Melodies & Notes..."}
                            </p>
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden shadow-inner">
                             <div className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-700" style={{ width: `${activeJob.progress}%` }}></div>
                        </div>
                    </div>
                ) : activeJob.status === 'FAILED' ? (
                    <div className="max-w-lg mx-auto text-center space-y-4 py-12">
                        <p className="text-amber-300 font-bold" dir="rtl">{activeJob.error || 'ההמרה נכשלה'}</p>
                        <button type="button" onClick={() => { setActiveJob(null); setActiveJobId(null); }} className="px-6 py-3 bg-white text-black rounded-xl font-black uppercase text-xs">נסה שוב</button>
                    </div>
                ) : activeJob.result && (
                    <div className="flex flex-col gap-4 h-full animate-in zoom-in-95 duration-500">
                        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-[#0A0A0C] p-4 md:p-6 rounded-3xl border border-white/10">
                            <div className="flex gap-6">
                                <div><div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Tempo</div><div className="text-2xl font-black font-mono">{activeJob.result.bpm} <span className="text-sm opacity-30">BPM</span></div></div>
                                <div><div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Key</div><div className="text-2xl font-black font-mono text-blue-400">{activeJob.result.key} <span className="text-sm opacity-60">{activeJob.result.scale}</span></div></div>
                            </div>
                            <button onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} className={`w-14 h-14 self-center rounded-full flex items-center justify-center ${isPlaying ? 'bg-red-500 text-white' : 'bg-white text-black'}`}>
                                {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-1" />}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {ELITE_16_CHANNELS.map((ch) => {
                                const n = ((activeJob.result as any)[ch] || []).length;
                                return (
                                    <div key={ch} className={`rounded-xl border px-3 py-2 ${n ? 'border-blue-500/30 bg-blue-500/10' : 'border-white/5 bg-white/5'}`}>
                                        <div className="text-[9px] font-black uppercase text-gray-400">{ch.replace(/ch\d+_/, '')}</div>
                                        <div className="text-sm font-black">{n} notes</div>
                                    </div>
                                );
                            })}
                        </div>
                        {activeJob.quality && <QualityReportCard report={activeJob.quality} compact />}
                        <div className="flex-1 min-h-[180px] md:min-h-[320px] relative rounded-2xl overflow-hidden border border-white/10">
                            <LabPianoRoll groove={activeJob.result} progress={progress} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
