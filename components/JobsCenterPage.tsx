
import React, { useState, useEffect } from 'react';
import { jobQueueService, Job } from '../services/jobQueueService';
import { GrooveObject } from '../types';
import { Activity, CheckCircle, AlertTriangle, Loader2, Download, Trash2, ArrowRight, Zap, Waves, FileAudio } from 'lucide-react';
import { downloadFullArrangementMidi } from '../services/midiService';

interface JobsCenterPageProps {
    onOpenGroove: (groove: GrooveObject) => void;
    onClose: () => void;
}

const JobRow: React.FC<{ job: Job, onOpen: (g: GrooveObject) => void, onCancel: (id: string) => void }> = ({ job, onOpen, onCancel }) => {
    
    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (job.result) {
            if (job.type === 'MIDI_RENDER') {
                const blob = job.result as Blob;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Rendered_Audio_${Date.now()}.wav`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else {
                downloadFullArrangementMidi(job.result);
            }
        }
    };

    const handleOpen = () => {
        if (job.result && job.type !== 'MIDI_RENDER') onOpen(job.result);
    };

    return (
        <div className="bg-[#111] border border-white/5 rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 group hover:border-white/10 transition-all">
            <div className="flex items-center gap-3 md:gap-4">
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border shrink-0 ${
                    job.status === 'COMPLETED' ? 'bg-green-900/20 border-green-500/30 text-green-500' :
                    job.status === 'PROCESSING' ? 'bg-blue-900/20 border-blue-500/30 text-blue-400' :
                    job.status === 'FAILED' ? 'bg-red-900/20 border-red-500/30 text-red-500' :
                    'bg-gray-800 border-gray-700 text-gray-400'
                }`}>
                    {job.status === 'COMPLETED' && <CheckCircle size={16} />}
                    {job.status === 'PROCESSING' && <Loader2 size={16} className="animate-spin" />}
                    {job.status === 'FAILED' && <AlertTriangle size={16} />}
                    {job.status === 'PENDING' && <Activity size={16} />}
                </div>
                
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold text-xs md:text-sm truncate max-w-[150px] md:max-w-none">{job.name}</span>
                        <span className={`text-[8px] md:text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-bold whitespace-nowrap ${
                            job.type === 'MIDI_GENERATION' ? 'bg-fuchsia-900/30 text-fuchsia-400' : 
                            job.type === 'MIDI_RENDER' ? 'bg-orange-900/30 text-orange-400' :
                            job.type === 'AUDIO_REGRESSION' ? 'bg-blue-900/30 text-blue-400' :
                            'bg-gray-800 text-gray-400'
                        }`}>
                            {job.type === 'MIDI_GENERATION' ? 'GEN' : job.type === 'MIDI_RENDER' ? 'RENDER' : job.type === 'AUDIO_REGRESSION' ? 'AUDIO' : 'TASK'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-[8px] md:text-[10px] text-gray-500 font-mono mt-0.5">
                        <span>{new Date(job.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        {job.error && <span className="text-red-400 truncate">• {job.error}</span>}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-3 md:gap-4 mt-1 md:mt-0">
                {job.status === 'PROCESSING' && (
                    <div className="flex flex-col items-start md:items-end gap-1 w-full md:w-24">
                        <span className="text-[9px] text-blue-400 font-bold">{job.progress}%</span>
                        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${job.progress}%` }}></div>
                        </div>
                    </div>
                )}

                {job.status === 'COMPLETED' && (
                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={handleDownload} className="flex-1 md:flex-none p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors flex justify-center" title="Download Result">
                            <Download size={14} />
                        </button>
                        {job.type !== 'MIDI_RENDER' && (
                            <button onClick={handleOpen} className="flex-[2] md:flex-none px-3 md:px-4 py-2 bg-white text-black text-[10px] md:text-xs font-bold uppercase rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                                Open <ArrowRight size={12} />
                            </button>
                        )}
                    </div>
                )}

                {(job.status === 'PENDING' || job.status === 'PROCESSING') && (
                    <button onClick={() => onCancel(job.id)} className="w-full md:w-auto text-red-500 hover:text-red-400 text-[9px] font-bold uppercase px-3 py-1.5 border border-red-900/30 rounded hover:bg-red-900/10 text-center">
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
};

export const JobsCenterPage: React.FC<JobsCenterPageProps> = ({ onOpenGroove, onClose }) => {
    const [jobs, setJobs] = useState<Job[]>([]);

    useEffect(() => {
        const unsub = jobQueueService.subscribe((list) => {
            setJobs(list);
        });
        return () => unsub();
    }, []);

    const activeCount = jobs.filter(j => j.status === 'PROCESSING').length;

    return (
        <div className="w-full h-full bg-[#050507] text-white flex flex-col font-sans animate-in fade-in">
            {/* Header */}
            <div className="h-16 md:h-20 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-4 md:px-8 shrink-0">
                <div className="flex flex-col">
                    <h1 className="text-lg md:text-2xl font-black uppercase tracking-tighter text-white">
                        Task <span className="text-studio-accent">List</span>
                    </h1>
                    <p className="text-[8px] md:text-[10px] text-gray-500 font-mono uppercase">Background Progress</p>
                </div>
                <div className="flex gap-2">
                    {activeCount > 0 && (
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#111] rounded-lg border border-white/5">
                            <Activity size={12} className="text-blue-400" />
                            <span className="text-[10px] font-bold">{activeCount}</span>
                        </div>
                    )}
                    <button onClick={() => jobQueueService.clearCompleted()} className="text-[8px] md:text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest px-3 py-1.5 hover:bg-white/5 rounded-lg transition-all border border-white/5">
                        Clear
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-3">
                    {jobs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-white/5 rounded-2xl opacity-40">
                            <Activity className="w-8 h-8 text-gray-700 mb-2" />
                            <p className="text-xs font-mono uppercase tracking-widest">No active tasks</p>
                        </div>
                    ) : (
                        jobs.map(job => (
                            <JobRow 
                                key={job.id} 
                                job={job} 
                                onOpen={onOpenGroove} 
                                onCancel={(id) => jobQueueService.cancelJob(id)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
