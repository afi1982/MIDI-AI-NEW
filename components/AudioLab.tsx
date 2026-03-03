
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { jobQueueService, Job } from '../services/jobQueueService';
import { downloadFullArrangementMidi } from '../services/midiService';
import { AudioWaveform, ArrowLeft, Loader2, Play, Pause, Download, Microscope, ShieldCheck, Zap, RefreshCw, Star, Layers, Settings2, Clock } from 'lucide-react';
import { GrooveObject, NoteEvent } from '../types';
import { ELITE_16_CHANNELS } from '../services/maestroService';
import { theoryEngine } from '../services/theoryEngine';
import { SourceExportButton } from './SourceExportButton';

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
                <div className="flex items-center gap-2 text-sky-400"><Star size={10} /><span className="text-[10px] font-black uppercase">1:1 Mono Lead Mode</span></div>
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
    const [manualBpm, setManualBpm] = useState<number>(0);
    const [showSettings, setShowSettings] = useState(false);
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

    const onDrop = useCallback((files: File[]) => {
        if (files.length === 0) return;
        const file = files[0];
        setAudioUrl(URL.createObjectURL(file));
        const overrideBpm = manualBpm > 20 ? manualBpm : undefined;
        setActiveJobId(jobQueueService.addAudioJob(file, overrideBpm));
    }, [manualBpm]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
        onDrop, 
        accept: { 'audio/*': ['.mp3', '.wav', '.flac'] }, 
        maxFiles: 1, 
        disabled: !!activeJobId 
    } as any);

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
            <header className="h-20 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-8 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><ArrowLeft size={20} /></button>
                    <div className="flex flex-col">
                        <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter italic leading-none">Audio to <span className="text-blue-500">MIDI</span></h1>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">Convert Audio Files to MIDI V117</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowSettings(!showSettings)} 
                        className={`p-2 rounded-lg transition-all ${showSettings ? 'bg-blue-500 text-white shadow-glow' : 'bg-white/5 text-gray-400'}`}
                        title="Analysis Settings"
                    >
                        <Settings2 size={18} />
                    </button>
                    <SourceExportButton pageKey="AUDIO_LAB" label="Acoustic Logic" />
                    {activeJob?.status === 'COMPLETED' && (
                        <button onClick={() => downloadFullArrangementMidi(activeJob.result)} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold flex items-center gap-2 shadow-glow transition-all active:scale-95"><Download size={16} /> Export V117 MIDI</button>
                    )}
                </div>
            </header>

            {showSettings && !activeJobId && (
                <div className="bg-[#0A0A0B] border-b border-white/5 p-4 md:px-8 animate-in slide-in-from-top-2">
                    <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6">
                        <div className="flex items-center gap-4 bg-black/40 p-4 rounded-2xl border border-white/5 w-full md:w-auto">
                            <Clock size={16} className="text-blue-400" />
                            <div className="flex flex-col">
                                <label className="text-[8px] font-black text-gray-500 uppercase">Pre-transcription BPM Override</label>
                                <input 
                                    type="number" 
                                    placeholder="Auto" 
                                    value={manualBpm || ''} 
                                    onChange={(e) => setManualBpm(parseInt(e.target.value))}
                                    className="bg-transparent border-none outline-none text-white font-bold w-24 text-lg"
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-500 max-w-sm leading-relaxed">
                            If the AI misidentifies the tempo, enter the correct BPM here. This forces the 120-tick grid alignment protocol for better DAW compatibility.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                {!activeJob ? (
                    <div className="max-w-4xl mx-auto space-y-8">
                        <div {...getRootProps()} className={`w-full h-96 border-2 border-dashed rounded-[3rem] flex flex-col items-center justify-center cursor-pointer bg-[#0A0A0C] transition-all ${isDragActive ? 'border-blue-500 bg-blue-500/5 shadow-2xl' : 'border-white/10 hover:border-white/20 shadow-xl'}`}>
                            <input {...getInputProps()} />
                            <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 border border-blue-500/20">
                                <AudioWaveform size={48} className={isDragActive ? 'text-blue-400 animate-pulse' : 'text-gray-500'} />
                            </div>
                            <h3 className="text-2xl font-black uppercase tracking-widest text-white italic">Audio to MIDI</h3>
                            <p className="text-sm text-gray-500 font-medium mt-4 uppercase text-center max-w-sm">Upload a song to extract a 1:1 monophonic lead melody.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white/5 border border-white/5 p-6 rounded-3xl group hover:border-blue-500/30 transition-all">
                                <Layers className="text-blue-500 mb-3" size={20} />
                                <h4 className="text-xs font-black uppercase mb-2">1:1 Lead Extraction</h4>
                                <p className="text-[10px] text-gray-500 leading-relaxed">Focuses entirely on a single prominent melody. Ignores chords, drums, and bass for pure monophonic accuracy.</p>
                            </div>
                            <div className="bg-white/5 border border-white/5 p-6 rounded-3xl group hover:border-amber-500/30 transition-all">
                                <Zap className="text-amber-500 mb-3" size={20} />
                                <h4 className="text-xs font-black uppercase mb-2">RMS Mapping</h4>
                                <p className="text-[10px] text-gray-500 leading-relaxed">Direct translation of acoustic amplitude to MIDI Velocity (0-127). No static levels.</p>
                            </div>
                            <div className="bg-white/5 border border-white/5 p-6 rounded-3xl group hover:border-green-500/30 transition-all">
                                <ShieldCheck className="text-green-500 mb-3" size={20} />
                                <h4 className="text-xs font-black uppercase mb-2">Micro-tonality</h4>
                                <p className="text-[10px] text-gray-500 leading-relaxed">Captures frequency fluctuations as Pitch Bend data. Preserves the ethnic soul of the instrument.</p>
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
                ) : activeJob.result && (
                    <div className="flex flex-col gap-6 h-full animate-in zoom-in-95 duration-500">
                        <div className="flex justify-between items-center bg-[#0A0A0C] p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
                            <div className="flex gap-12">
                                <div><div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Detected Tempo</div><div className="text-3xl font-black font-mono">{activeJob.result.bpm} <span className="text-sm opacity-30">BPM</span></div></div>
                                <div><div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Transcription</div><div className="text-3xl font-black font-mono text-blue-400">1:1 <span className="text-xl opacity-60 italic">MONO LEAD</span></div></div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right hidden sm:block">
                                    <div className="text-[10px] font-black text-green-500 uppercase">Micro-tonal Bends Included</div>
                                    <div className="text-[9px] text-gray-500 font-mono">RMS Energy Mapping: Active</div>
                                </div>
                                <button onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl hover:scale-105 active:scale-95 ${isPlaying ? 'bg-red-500 text-white' : 'bg-white text-black'}`}>
                                    {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" className="ml-1.5" />}
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 min-h-[400px] relative rounded-[3rem] overflow-hidden shadow-2xl border border-white/10">
                            <LabPianoRoll groove={activeJob.result} progress={progress} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
