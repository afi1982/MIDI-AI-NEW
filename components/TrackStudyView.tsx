
import React, { useState, useEffect } from 'react';
import { deconstructYoutubeLink } from '../services/geminiService';
import { maestroService } from '../services/maestroService';
import { jobQueueService } from '../services/jobQueueService';
import { GrooveObject } from '../types';
import { Zap, Youtube, Loader2, ArrowLeft, User, Activity, ExternalLink } from 'lucide-react';
import { SourceExportButton } from './SourceExportButton';

interface TrackStudyViewProps {
  onBlueprintLoaded: (groove: any) => void;
  onAnalyzeStart: (files: File[]) => void;
  studyState: any;
  onInject?: (groove: GrooveObject) => void;
  onClose: () => void;
}

const TrackStudyView: React.FC<TrackStudyViewProps> = ({ onInject, onClose }) => {
  const [url, setUrl] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<any>(null);

  useEffect(() => {
    if (!jobId) return;
    const unsub = jobQueueService.subscribe((jobs) => {
        const found = jobs.find(j => j.id === jobId);
        if (found) setActiveJob(found);
    });
    return () => unsub();
  }, [jobId]);

  const handleScan = async () => {
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      setError("Please enter a valid YouTube URL");
      return;
    }
    
    setError(null);
    const id = jobQueueService.addForensicStudyJob(url);
    setJobId(id);
  };

  const reset = () => {
      setJobId(null);
      setActiveJob(null);
      setUrl('');
      setError(null);
  };

  return (
    <div className="flex flex-col h-full bg-black text-white font-sans overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-30%] left-[20%] w-[1000px] h-[1000px] bg-gradient-to-r from-red-900/20 to-blue-900/20 rounded-full blur-[180px] opacity-30"></div>
      </div>

      <div className="flex justify-between items-center px-8 py-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-3 bg-[#111] hover:bg-[#222] rounded-full text-white transition-all">
                <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Forensic <span className="text-red-500">Lab</span>
            </h1>
          </div>
          <SourceExportButton pageKey="LAB" label="Lab Logic" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 z-10 overflow-y-auto custom-scrollbar w-full max-w-5xl mx-auto">
          
          <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Analyze any track. 1:1.</h2>
              <p className="text-gray-400 text-lg">Paste a YouTube link. We'll analyze the artist, style, and reconstruct the MIDI in the background.</p>
          </div>

          {!activeJob && (
              <div className="w-full max-w-2xl space-y-4">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-blue-600 rounded-2xl blur opacity-25 group-focus-within:opacity-75 transition duration-1000"></div>
                    <div className="relative flex items-center bg-[#0a0a0a] border border-white/10 rounded-2xl p-2 h-20">
                        <div className="p-4 text-red-500"><Youtube size={32} /></div>
                        <input 
                            type="text" 
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="flex-1 bg-transparent border-none outline-none text-lg font-medium placeholder:text-gray-700"
                        />
                        <button 
                            onClick={handleScan}
                            className="h-full px-8 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-95"
                        >
                            Scan
                        </button>
                    </div>
                </div>
                {error && <p className="text-center text-red-500 font-bold text-sm bg-red-500/10 py-2 rounded-lg">{error}</p>}
              </div>
          )}

          {activeJob && activeJob.status === 'PROCESSING' && (
              <div className="flex flex-col items-center justify-center w-full animate-in fade-in duration-500">
                  <div className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-3xl p-12 text-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-red-600/5 to-blue-600/5 animate-pulse"></div>
                      <Loader2 className="w-16 h-16 text-red-500 mx-auto mb-6 animate-spin" />
                      <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Deconstructing <span className="text-red-500">Signal</span></h3>
                      <p className="text-gray-500 font-mono text-xs uppercase tracking-[0.3em]">{activeJob.name}</p>
                      
                      <div className="mt-10 w-full bg-white/5 rounded-full h-2 overflow-hidden">
                          <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${activeJob.progress}%` }}></div>
                      </div>
                      <p className="mt-8 text-gray-500 text-sm">This is working in the background. You can navigate away and check "Jobs" later.</p>
                  </div>
              </div>
          )}

          {activeJob && activeJob.status === 'COMPLETED' && (
              <div className="w-full max-w-4xl animate-in zoom-in-95 duration-500 space-y-6">
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 flex flex-col md:flex-row gap-8 items-center border-l-4 border-l-red-500">
                      <div className="w-24 h-24 bg-gradient-to-br from-gray-800 to-black rounded-full flex items-center justify-center shadow-2xl border border-white/5">
                          <User className="w-12 h-12 text-gray-500" />
                      </div>
                      <div className="flex-1 text-center md:text-left">
                          <h3 className="text-3xl font-black uppercase text-white mb-1">{activeJob.result.artist}</h3>
                          <p className="text-red-500 font-bold uppercase tracking-widest text-xs mb-4">{activeJob.result.trackName}</p>
                          <div className="bg-white/5 p-4 rounded-xl text-sm text-gray-400 italic leading-relaxed">
                            "{activeJob.result.explanation}"
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 shrink-0">
                          <div className="bg-white/5 px-4 py-2 rounded-lg text-center">
                              <div className="text-[8px] text-gray-500 uppercase font-bold">BPM</div>
                              <div className="text-lg font-black">{activeJob.result.bpm}</div>
                          </div>
                          <div className="bg-white/5 px-4 py-2 rounded-lg text-center">
                              <div className="text-[8px] text-gray-500 uppercase font-bold">Key</div>
                              <div className="text-lg font-black">{activeJob.result.key} {activeJob.result.scale}</div>
                          </div>
                      </div>
                  </div>

                  <div className="flex gap-4">
                      <button 
                        onClick={reset}
                        className="flex-1 py-5 bg-white/5 border border-white/10 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-white/10 transition-all"
                      >
                        Reset
                      </button>
                      <button 
                        onClick={() => onInject && onInject(activeJob.result)}
                        className="flex-[2] py-5 bg-gradient-to-r from-red-600 to-blue-600 hover:opacity-90 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95"
                      >
                        <Zap size={20} /> Open in Studio
                      </button>
                  </div>
              </div>
          )}

          {activeJob && activeJob.status === 'FAILED' && (
              <div className="text-center space-y-6">
                   <div className="p-8 bg-red-900/10 border border-red-500/30 rounded-3xl max-w-xl mx-auto">
                        <Activity className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-red-500 uppercase mb-2">Analysis Failed</h3>
                        <p className="text-gray-400 text-sm">{activeJob.error}</p>
                   </div>
                   <button onClick={reset} className="px-8 py-3 bg-white text-black font-bold uppercase rounded-xl">Try Another Link</button>
              </div>
          )}
      </div>
    </div>
  );
};

export default TrackStudyView;
