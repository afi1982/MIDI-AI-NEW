
import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { GrooveObject, MusicalKey, ScaleType, MusicGenre, EliteAudioObject, MusicalGenreContext, MoodContext, InstrumentRole } from '../types';
import { Waves, Music, ArrowLeft, Download, Zap, Loader2, CheckCircle, FileAudio, ListChecks, Eye, Layout, FileVideo, ShieldAlert, Microscope, FileCode, Wand2, RefreshCw, Activity, Search, Sparkles, Heart, ShieldCheck, Box, Info, AudioWaveform, ArrowRight } from 'lucide-react';
import { Midi } from '@tonejs/midi';
import { theoryEngine } from '../services/theoryEngine';
import { jobQueueService } from '../services/jobQueueService';
import { downloadFullArrangementMidi } from '../services/midiService';

interface ToolsViewProps {
  onAnalyzeStart: (file: File) => void;
  studyState: any;
  onInject?: (groove: GrooveObject) => void;
  onClose: () => void;
}

const ContextBadge: React.FC<{ context: any; onOverride: () => void }> = ({ context, onOverride }) => (
    <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-2xl animate-in fade-in slide-in-from-top-2">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
        <div className="flex flex-col">
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Context Bridge Active</span>
            <span className="text-[10px] text-white font-bold">{context.genre} • {context.mood} • {context.role}</span>
        </div>
        <button onClick={onOverride} className="mr-2 text-[9px] text-emerald-400/60 hover:text-emerald-400 font-bold uppercase transition-colors">Override</button>
    </div>
);

const PianoRollPreview: React.FC<{ notes: any[], targetKey: string, targetScale: string }> = ({ notes, targetKey, targetScale }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !notes || notes.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const midiValues = notes.map(n => n.midi || theoryEngine.getMidiNote(n.n));
        const minMidi = Math.min(...midiValues) - 2;
        const maxMidi = Math.max(...midiValues) + 2;
        const range = maxMidi - minMidi;
        const maxStep = 32;

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 32; i++) {
            const x = (i / 32) * canvas.width;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }

        notes.forEach(note => {
            const midi = note.midi || theoryEngine.getMidiNote(note.n);
            const x = (note.s / maxStep) * canvas.width;
            const y = canvas.height - ((midi - minMidi) / range) * canvas.height;
            const w = (note.d / 120) * (canvas.width / 32);
            const h = 10;

            const inScale = theoryEngine.isNoteInScale(note.n || note.note, targetKey, targetScale);
            ctx.fillStyle = inScale ? '#0ea5e9' : '#ef4444';
            ctx.fillRect(x, y - h, Math.max(w, 4), h);
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.strokeRect(x, y - h, Math.max(w, 4), h);
        });
    }, [notes, targetKey, targetScale]);

    return (
        <div className="relative w-full bg-black rounded-xl border border-white/10 overflow-hidden mb-4">
            <canvas ref={canvasRef} width={800} height={200} className="w-full h-[200px]" />
        </div>
    );
};

const ToolsView: React.FC<ToolsViewProps> = ({ onAnalyzeStart, studyState, onInject, onClose }) => {
    const [activeTool, setActiveTool] = useState<'NONE' | 'AUDIO_TO_MIDI' | 'VIDEO_TO_AUDIO' | 'VIDEO_SYSTEM_ANALYSIS' | 'MIDI_FORENSICS' | 'MELODY_ARCHITECT'>('NONE');
    
    // Shared Bridge State
    const [activeBridgeObject, setActiveBridgeObject] = useState<EliteAudioObject | null>(null);
    const [overrideBridge, setOverrideBridge] = useState(false);

    // Universal Job Monitoring
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [activeJob, setActiveJob] = useState<any>(null);

    // Sync with Job Queue
    useEffect(() => {
        if (activeJobId) {
            const unsub = jobQueueService.subscribe(jobs => {
                const job = jobs.find(j => j.id === activeJobId);
                if (job) {
                    setActiveJob(job);
                    if (job.status === 'COMPLETED' && job.type === 'MELODY_ARCHITECT') {
                        setActiveBridgeObject(job.result);
                    }
                }
            });
            return () => unsub();
        }
    }, [activeJobId]);

    // Restore active jobs on mount if matching current tool
    useEffect(() => {
        const jobs = jobQueueService.getJobs();
        const pending = jobs.find(j => j.status === 'PROCESSING' || j.status === 'PENDING');
        if (pending) {
            if (activeTool === 'MELODY_ARCHITECT' && pending.type === 'MELODY_ARCHITECT') setActiveJobId(pending.id);
            if (activeTool === 'MIDI_FORENSICS' && pending.type === 'FORENSIC_ANALYSIS') setActiveJobId(pending.id);
            if (activeTool === 'AUDIO_TO_MIDI' && pending.type === 'AUDIO_REGRESSION') setActiveJobId(pending.id);
        }
    }, [activeTool]);

    const onAudioDrop = (files: File[]) => {
        if (files.length === 0) return;
        const file = files[0];
        const id = jobQueueService.addAudioJob(file);
        setActiveJobId(id);
    };

    const { getRootProps: getAudioRoot, getInputProps: getAudioInput, isDragActive: isAudioDrag } = useDropzone({
        onDrop: onAudioDrop,
        accept: { 'audio/*': ['.mp3', '.wav', '.flac'] },
        maxFiles: 1
    } as any);

    // Forensic File Drop
    const onForensicDrop = (files: File[]) => {
        if (files.length === 0) return;
        const file = files[0];
        const id = jobQueueService.addForensicJob(file, true);
        setActiveJobId(id);
    };

    const { getRootProps: getForensicRoot, getInputProps: getForensicInput, isDragActive: isForensicDrag } = useDropzone({
        onDrop: onForensicDrop,
        accept: { 'audio/midi': ['.mid', '.midi'] },
        maxFiles: 1
    } as any);

    // Melody Architect State
    const [melodyParams, setMelodyParams] = useState({
        genre: 'Psytrance' as MusicalGenreContext,
        mood: 'Euphoric' as MoodContext,
        role: 'Lead' as InstrumentRole,
        artist: 'astrix',
        key: MusicalKey.F_SHARP,
        scale: ScaleType.PHRYGIAN,
        complexity: 7
    });

    const handleGenerateMelody = async () => {
        setActiveBridgeObject(null);
        const id = jobQueueService.addMelodyJob(melodyParams);
        setActiveJobId(id);
    };

    const sendToForensics = () => {
        setActiveTool('MIDI_FORENSICS');
        if (activeBridgeObject) {
            const id = jobQueueService.addForensicJob(activeBridgeObject, false);
            setActiveJobId(id);
        }
    };

    const downloadMelodyMidi = () => {
        const data = activeBridgeObject?.rawData;
        if (!data) return;

        try {
            const midi = new Midi();
            // הגדרת רזולוציה סטנדרטית (PPQ - Pulses Per Quarter Note)
            // רוב ה-DAWs עובדים עם 480 או 960. נבחר 480 ליציבות מקסימלית.
            const PPQ = 480; 
            
            midi.header.setTempo(145);
            midi.header.name = `Elite_Bridge_Corrected`;
            const track = midi.addTrack();

            data.forEach(n => {
                const snappedStep = Math.round(n.s); 
                const startTick = snappedStep * 120;

                let finalNote = n.n;
                const isInScale = theoryEngine.isNoteInScale(n.n, melodyParams.key, melodyParams.scale);
                
                if (!isInScale) {
                    finalNote = theoryEngine.getClosestNoteInScale(n.n, melodyParams.key, melodyParams.scale);
                }

                track.addNote({
                    name: finalNote,
                    ticks: startTick,
                    durationTicks: n.d, // Assuming internal duration is already aligned to 120 ticks per 16th
                    velocity: n.v
                });
            });

            // Standard download process
            const midiArray = midi.toArray();
            const blob = new Blob([midiArray], { type: 'audio/midi' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Fixed_Context_${Date.now()}.mid`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        } catch (err) { 
            console.error(err);
            alert("MIDI Export Error"); 
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#050508] text-white overflow-hidden">
            <div className="h-16 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-6 shrink-0 z-30 shadow-xl">
                <div className="flex items-center gap-4">
                    <button onClick={activeTool === 'NONE' ? onClose : () => { setActiveTool('NONE'); setActiveJobId(null); setActiveJob(null); }} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all">
                        <ArrowLeft size={18} className="rotate-180" />
                    </button>
                    <h1 className="text-xl font-black uppercase tracking-tighter">
                        AI Studio <span className="text-sky-500">Tools</span>
                    </h1>
                </div>
                {activeTool === 'MIDI_FORENSICS' && activeBridgeObject && !overrideBridge && (
                    <ContextBadge context={activeBridgeObject.context} onOverride={() => setOverrideBridge(true)} />
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar pb-32">
                <div className="max-w-7xl mx-auto">
                    {activeTool === 'NONE' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-500">
                            
                            <div onClick={() => setActiveTool('AUDIO_TO_MIDI')} className="group bg-gradient-to-br from-[#0a0a0c] to-[#151518] border border-blue-500/30 rounded-3xl p-8 text-center cursor-pointer hover:border-blue-500 transition-all hover:shadow-[0_0_40px_rgba(59,130,246,0.15)] relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity"><AudioWaveform size={60} /></div>
                                <AudioWaveform className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                                <h3 className="text-xl font-black italic">Audio to MIDI</h3>
                                <p className="text-xs text-gray-500 mt-2">Convert audio files to MIDI notes using AI.</p>
                            </div>

                            <div onClick={() => setActiveTool('MELODY_ARCHITECT')} className="group bg-[#0a0a0c] border border-sky-500/20 rounded-3xl p-8 text-center cursor-pointer hover:border-sky-500/50 transition-all">
                                <Sparkles className="w-10 h-10 text-sky-500 mx-auto mb-4" />
                                <h3 className="text-lg font-bold">Melody Generator</h3>
                                <p className="text-xs text-gray-500 mt-2">Create new melodies based on style and mood.</p>
                            </div>

                            <div onClick={() => setActiveTool('MIDI_FORENSICS')} className="group bg-[#0a0a0c] border border-fuchsia-500/20 rounded-3xl p-8 text-center cursor-pointer hover:border-fuchsia-500/50 transition-all">
                                <Microscope className="w-10 h-10 text-fuchsia-500 mx-auto mb-4" />
                                <h3 className="text-lg font-bold">MIDI Fixer</h3>
                                <p className="text-xs text-gray-500 mt-2">Analyze and fix MIDI timing and scale issues.</p>
                            </div>
                        </div>
                    )}

                    {/* SHARED JOB STATUS DISPLAY */}
                    {activeJob && activeJob.status === 'PROCESSING' && (
                        <div className="bg-[#111] border border-white/10 rounded-[2rem] p-8 md:p-12 text-center mb-8 animate-in fade-in">
                            <div className="flex flex-col items-center">
                                <div className="relative mb-6">
                                    <div className="w-24 h-24 rounded-full border-4 border-white/5 border-t-sky-500 animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center font-black text-xl">{activeJob.progress}%</div>
                                </div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Processing Task</h3>
                                <p className="text-sky-400 font-mono text-xs uppercase tracking-widest animate-pulse">{activeJob.name}</p>
                                <div className="mt-8 max-w-md mx-auto w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-sky-500 transition-all duration-500" style={{ width: `${activeJob.progress}%` }}></div>
                                </div>
                                <button onClick={() => jobQueueService.cancelJob(activeJob.id)} className="mt-6 text-red-500 text-xs font-bold uppercase hover:text-white">Cancel Job</button>
                            </div>
                        </div>
                    )}

                    {/* AUDIO TO MIDI VIEW */}
                    {activeTool === 'AUDIO_TO_MIDI' && !activeJob && (
                        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
                            <div className="text-center">
                                <h2 className="text-3xl font-black uppercase text-white mb-2">Audio <span className="text-blue-500">Analysis</span></h2>
                                <p className="text-gray-400 text-sm">Upload an audio file (MP3/WAV) to extract musical structure and notes.</p>
                            </div>
                            <div 
                                {...getAudioRoot()} 
                                className={`
                                    h-64 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center cursor-pointer transition-all
                                    ${isAudioDrag ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}
                                `}
                            >
                                <input {...getAudioInput()} />
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                                        <AudioWaveform className="w-10 h-10 text-blue-400" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-lg font-bold text-white uppercase tracking-widest">Drop Audio File</h3>
                                        <p className="text-xs text-gray-500 font-mono mt-1">MP3, WAV, FLAC (Max 20MB)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MELODY ARCHITECT VIEW */}
                    {activeTool === 'MELODY_ARCHITECT' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in">
                            {!activeJob && (
                                <div className="lg:col-span-4 space-y-6">
                                    <div className="bg-[#111] p-6 rounded-3xl border border-white/10 space-y-5">
                                        <h3 className="text-xs font-black text-sky-400 uppercase tracking-widest flex items-center gap-2"><Box size={14} /> Context Definition</h3>
                                        
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">Genre</label>
                                            <select value={melodyParams.genre} onChange={e => setMelodyParams({...melodyParams, genre: e.target.value as MusicalGenreContext})} className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs font-bold text-white">
                                                <option value="Techno">Techno (Strict Grid)</option>
                                                <option value="Jazz">Jazz (Swing Ratio)</option>
                                                <option value="Trap">Trap (Aggressive)</option>
                                                <option value="LoFi">LoFi (Lazy Timing)</option>
                                                <option value="Psytrance">Psytrance (Precision)</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">Mood</label>
                                            <select value={melodyParams.mood} onChange={e => setMelodyParams({...melodyParams, mood: e.target.value as MoodContext})} className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs font-bold text-white">
                                                <option value="Euphoric">Euphoric</option>
                                                <option value="Melancholic">Melancholic (Ghost Notes)</option>
                                                <option value="Aggressive">Aggressive</option>
                                                <option value="Hypnotic">Hypnotic</option>
                                            </select>
                                        </div>

                                        <button onClick={handleGenerateMelody} className="w-full py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-glow transition-all">
                                            <Zap size={18} /> Generate Melody
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="lg:col-span-8 space-y-6">
                                {activeBridgeObject ? (
                                    <div className="w-full space-y-8 animate-in slide-in-from-bottom-4 bg-[#0a0a0c] border border-white/10 rounded-[2rem] p-8">
                                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                            <div>
                                                <h2 className="text-xl font-black text-white">Elite Object Generated</h2>
                                                <span className="text-[10px] font-mono text-gray-500 uppercase">UID: {activeBridgeObject.id.substring(0,8)}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={downloadMelodyMidi} className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase transition-all">Export MIDI</button>
                                                <button onClick={sendToForensics} className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2">
                                                    Send to Fixer <ArrowLeft size={12} className="rotate-180" />
                                                </button>
                                            </div>
                                        </div>
                                        <PianoRollPreview notes={activeBridgeObject.rawData} targetKey={melodyParams.key} targetScale={melodyParams.scale} />
                                    </div>
                                ) : (
                                    !activeJob && (
                                        <div className="text-center py-20 border-2 border-dashed border-white/10 rounded-[2rem]">
                                            <Wand2 size={48} className="mx-auto mb-4 text-gray-600" />
                                            <h3 className="text-2xl font-black uppercase italic text-gray-400">Architect is Idle</h3>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}

                    {/* MIDI FORENSICS VIEW */}
                    {activeTool === 'MIDI_FORENSICS' && (
                        <div className="space-y-6">
                            {activeJob?.status === 'COMPLETED' && activeJob.type === 'FORENSIC_ANALYSIS' ? (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="bg-[#0a0a0c] border border-emerald-500/20 rounded-[2rem] p-8">
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="text-xl font-black text-white uppercase flex items-center gap-3">
                                                    <ShieldCheck className="text-emerald-400" /> Auto-Corrected Stream
                                                </h3>
                                                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-bold uppercase">Locked to Context</span>
                                            </div>
                                            <PianoRollPreview notes={activeJob.result.corrected} targetKey={'F#'} targetScale={'Phrygian'} />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-6">
                                        <div className="bg-[#111] p-6 rounded-3xl border border-white/10">
                                            <h3 className="text-xs font-black text-fuchsia-400 uppercase tracking-widest mb-4">Forensic Analysis</h3>
                                            <p className="text-[10px] text-gray-500 mt-6 leading-relaxed italic">
                                                "Forensic scan complete. Detected logic flaws have been auto-corrected."
                                            </p>
                                            <button onClick={() => { setActiveJob(null); setActiveJobId(null); }} className="mt-4 w-full py-2 bg-white/5 border border-white/10 rounded text-[10px] font-bold uppercase hover:bg-white/10">
                                                Analyze Another
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                !activeJob && (
                                    <div 
                                        {...getForensicRoot()} 
                                        className={`
                                            text-center py-20 border-2 border-dashed rounded-[2rem] cursor-pointer transition-all
                                            ${isForensicDrag ? 'border-fuchsia-500 bg-fuchsia-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}
                                        `}
                                    >
                                        <input {...getForensicInput()} />
                                        <ShieldAlert size={48} className="mx-auto mb-4 text-gray-600" />
                                        <h2 className="text-xl font-bold text-gray-400">Drop MIDI for Forensic Audit</h2>
                                        <p className="text-xs text-gray-600 mt-2">Or wait for transfer from Melody Architect</p>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ToolsView;
