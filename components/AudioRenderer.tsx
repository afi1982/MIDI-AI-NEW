
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
    Upload, FileAudio, Download, Settings, Loader2, 
    Music, CheckCircle, ArrowLeft, Layers, ShieldCheck, 
    Zap, Activity, Info, Clock
} from 'lucide-react';
import { midiRendererService, RenderProfile } from '../services/midiRendererService';
import { jobQueueService, Job } from '../services/jobQueueService';

interface AudioRendererProps {
    onClose: () => void;
}

const SOUNDFONT_PROFILES: (RenderProfile & { desc: string; tags: string[] })[] = [
    { id: 'fatboy', name: 'FatBoy Elite', engine: 'ELECTRONIC', desc: 'Modern high-impact synthesis. Thick bass and aggressive textures.', tags: ['Psytrance', 'Mainstage'] },
    { id: 'roland', name: 'Roland SC-55', engine: 'HARDWARE', desc: 'Classic 90s hardware emulation. Clean harmonics and stereo width.', tags: ['Goa', 'Retro'] },
    { id: 'fluid', name: 'FluidR3 Pro', engine: 'GENERAL', desc: 'Industry-standard general MIDI rendering. Natural balance.', tags: ['Studio', 'General'] }
];

export const AudioRenderer: React.FC<AudioRendererProps> = ({ onClose }) => {
    const [file, setFile] = useState<File | null>(null);
    const [selectedProfileId, setSelectedProfileId] = useState('fatboy');
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [activeJob, setActiveJob] = useState<Job | null>(null);

    useEffect(() => {
        if (!activeJobId) return;
        return jobQueueService.subscribe(jobs => {
            const job = jobs.find(j => j.id === activeJobId);
            if (job) setActiveJob(job);
        });
    }, [activeJobId]);

    const onDrop = useCallback((files: File[]) => {
        if (files[0]) {
            setFile(files[0]);
            setActiveJobId(null);
            setActiveJob(null);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'audio/midi': ['.mid', '.midi'] },
        maxFiles: 1,
        disabled: activeJob?.status === 'PROCESSING'
    } as any);

    const handleRender = () => {
        if (!file) return;
        const profile = SOUNDFONT_PROFILES.find(p => p.id === selectedProfileId)!;
        const id = jobQueueService.addRenderJob(file, profile);
        setActiveJobId(id);
    };

    const handleDownload = () => {
        if (!activeJob?.result) return;
        const blob = activeJob.result as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${file?.name.replace(/\.[^/.]+$/, "")}_${selectedProfileId.toUpperCase()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const reset = () => {
        setFile(null);
        setActiveJobId(null);
        setActiveJob(null);
    };

    return (
        <div className="h-full flex flex-col bg-[#050508] text-white animate-in fade-in" dir="ltr">
            <header className="h-16 md:h-20 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-6 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-gray-400 hover:text-white">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg md:text-2xl font-black uppercase tracking-tighter">
                            midi to <span className="text-fuchsia-500">mp3</span>
                        </h1>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Background Studio Rendering Engine</p>
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                        <ShieldCheck size={14} className="text-green-500" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase">PCM 44.1kHz / 16-bit</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* LEFT: SETTINGS & PROFILES */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-[#0A0A0C] border border-white/5 rounded-3xl p-6 shadow-2xl">
                            <h3 className="text-xs font-black text-fuchsia-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Layers size={14} /> Conversion Profile
                            </h3>
                            <div className="space-y-3">
                                {SOUNDFONT_PROFILES.map(profile => (
                                    <button 
                                        key={profile.id}
                                        onClick={() => activeJob?.status !== 'PROCESSING' && setSelectedProfileId(profile.id)}
                                        className={`w-full p-4 rounded-2xl text-left transition-all border group relative overflow-hidden ${
                                            selectedProfileId === profile.id 
                                            ? 'bg-fuchsia-500/10 border-fuchsia-500/40 text-white' 
                                            : 'bg-black border-white/5 text-gray-500 hover:border-white/20'
                                        }`}
                                    >
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className={`text-sm font-black uppercase tracking-tight ${selectedProfileId === profile.id ? 'text-fuchsia-400' : 'text-gray-400'}`}>
                                                    {profile.name}
                                                </span>
                                                {selectedProfileId === profile.id && <div className="w-2 h-2 rounded-full bg-fuchsia-500 shadow-[0_0_10px_#d946ef]"></div>}
                                            </div>
                                            <p className="text-[10px] leading-relaxed opacity-60 mb-3">{profile.desc}</p>
                                            <div className="flex gap-1">
                                                {profile.tags.map(t => (
                                                    <span key={t} className="text-[8px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 font-bold uppercase">{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-4">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Activity size={12} /> Tech Details
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                    <span className="text-gray-500 uppercase">Engine</span>
                                    <span className="text-fuchsia-400">BACKGROUND_JOB_WORKER</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                    <span className="text-gray-500 uppercase">Mastering</span>
                                    <span className="text-green-500">DYNAMIC_LIMITER_V2</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                    <span className="text-gray-500 uppercase">Sample Rate</span>
                                    <span className="text-white">44,100 Hz</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: ACTION AREA */}
                    <div className="lg:col-span-8 space-y-6">
                        {!file ? (
                            <div 
                                {...getRootProps()} 
                                className={`h-80 md:h-[450px] border-2 border-dashed rounded-[3rem] flex flex-col items-center justify-center cursor-pointer bg-[#0A0A0C] transition-all group ${
                                    isDragActive ? 'border-fuchsia-500 bg-fuchsia-500/5' : 'border-white/10 hover:border-white/20'
                                }`}
                            >
                                <input {...getInputProps()} />
                                <div className="w-24 h-24 bg-fuchsia-500/10 rounded-full flex items-center justify-center mb-8 border border-fuchsia-500/20 group-hover:scale-110 transition-transform">
                                    <Upload className="w-10 h-10 text-fuchsia-500" />
                                </div>
                                <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter">Load MIDI Archive</h2>
                                <p className="text-sm text-gray-500 font-medium mt-2 max-w-xs text-center px-6 leading-relaxed">
                                    Drop your MIDI session here to trigger a background MP3/WAV conversion.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-[#0A0A0C] border border-white/5 rounded-[3rem] p-8 md:p-16 text-center animate-in zoom-in-95 duration-500 shadow-2xl relative overflow-hidden">
                                
                                <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
                                    <div className="h-full bg-fuchsia-500 transition-all duration-300" style={{ width: `${activeJob?.progress || 0}%` }}></div>
                                </div>

                                <div className="w-24 h-24 bg-white/5 rounded-[2rem] mx-auto flex items-center justify-center mb-8 border border-white/10 shadow-inner">
                                    <Music className="w-12 h-12 text-fuchsia-500" />
                                </div>
                                <h2 className="text-2xl font-black text-white mb-2 truncate max-w-md mx-auto">{file.name}</h2>
                                <p className="text-[10px] font-mono text-gray-500 mb-12 uppercase tracking-widest">
                                    READY FOR <span className="text-fuchsia-500 font-black">{selectedProfileId}</span> CONVERSION
                                </p>

                                {activeJob?.status === 'PROCESSING' ? (
                                    <div className="max-w-md mx-auto space-y-6">
                                        <div className="flex justify-between items-end">
                                            <div className="flex items-center gap-3">
                                                <Loader2 size={18} className="animate-spin text-fuchsia-500" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Synthesizing in background...</span>
                                            </div>
                                            <span className="text-2xl font-black italic text-fuchsia-500">{activeJob.progress}%</span>
                                        </div>
                                        <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
                                            <div className="h-full bg-gradient-to-r from-fuchsia-600 to-sky-500 rounded-full shadow-[0_0_15px_rgba(217,70,239,0.5)] transition-all duration-300" style={{ width: `${activeJob.progress}%` }}></div>
                                        </div>
                                        <p className="text-[9px] text-gray-500 font-bold uppercase">You can leave this page; rendering continues in Jobs Center.</p>
                                    </div>
                                ) : activeJob?.status === 'COMPLETED' ? (
                                    <div className="space-y-8 animate-in fade-in">
                                        <div className="flex flex-col items-center gap-3 bg-green-500/10 border border-green-500/30 p-8 rounded-[2.5rem] max-w-sm mx-auto">
                                            <CheckCircle className="w-12 h-12 text-green-500 mb-2" />
                                            <span className="text-sm font-black uppercase tracking-[0.2em] text-green-400">Rendering Successful</span>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase">FILE OPTIMIZED & READY</p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                            <button 
                                                onClick={handleDownload}
                                                className="px-12 py-5 bg-white text-black hover:bg-fuchsia-500 hover:text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest transition-all shadow-[0_15px_30px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3 active:scale-95"
                                            >
                                                <Download size={18} /> Export WAV/MP3
                                            </button>
                                            <button 
                                                onClick={reset}
                                                className="px-8 py-5 bg-white/5 hover:bg-white/10 rounded-[1.5rem] font-bold text-xs uppercase tracking-widest transition-all border border-white/10"
                                            >
                                                New Conversion
                                            </button>
                                        </div>
                                    </div>
                                ) : activeJob?.status === 'FAILED' ? (
                                    <div className="space-y-4">
                                        <p className="text-red-500 font-bold">Rendering Failed: {activeJob.error}</p>
                                        <button onClick={reset} className="px-6 py-2 bg-white text-black rounded-lg font-bold uppercase">Try Again</button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-6">
                                        <button 
                                            onClick={handleRender}
                                            className="w-full max-w-md py-6 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-[1.5rem] font-black text-xl uppercase tracking-tighter transition-all shadow-[0_15px_40px_rgba(217,70,239,0.3)] flex items-center justify-center gap-4 active:scale-95 group"
                                        >
                                            <Zap size={24} className="fill-current group-hover:animate-pulse" />
                                            <span>Execute Conversion</span>
                                        </button>
                                        <button onClick={() => setFile(null)} className="text-[10px] text-gray-500 font-black uppercase hover:text-white underline decoration-white/20 underline-offset-8 transition-all">Cancel & Change File</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* WAVEFORM DECORATION */}
                        <div className="h-32 bg-black/60 rounded-[3rem] border border-white/5 overflow-hidden relative flex items-center justify-center p-8 opacity-40">
                             <div className="flex items-end gap-[3px] w-full h-full">
                                {Array.from({length: 80}).map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={`flex-1 bg-fuchsia-500/30 rounded-full transition-all duration-[400ms] ${activeJob?.status === 'PROCESSING' ? 'animate-pulse' : ''}`}
                                        style={{ height: activeJob?.status === 'COMPLETED' ? `${20 + Math.random() * 60}%` : activeJob?.status === 'PROCESSING' ? `${10 + Math.random() * 90}%` : '8%' }}
                                    ></div>
                                ))}
                             </div>
                             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                 <span className="text-[9px] font-black text-white/5 uppercase tracking-[1.5em]">Acoustic Spectrum Analysis</span>
                             </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
