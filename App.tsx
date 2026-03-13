
import React, { useState, useEffect, useRef } from 'react';
import { GrooveObject, GenerationParams, MusicGenre, MusicalKey, ScaleType, EnergyMode, BpmMode, ChannelKey } from './types.ts';
import { SUPPORTED_CHANNELS, ELITE_16_CHANNELS } from './services/maestroService.ts';
import { StudioPage } from './components/StudioPage.tsx';
import { WelcomeScreen } from './components/WelcomeScreen.tsx';
import { JobsCenterPage } from './components/JobsCenterPage.tsx';
import { Navigation } from './components/Navigation.tsx';
import { jobQueueService } from './services/jobQueueService';
import ChannelSelector from './components/ChannelSelector.tsx';
import { Zap, Lock, Cpu, Database, ShieldCheck, History, RefreshCw, AlertCircle } from 'lucide-react';
import { forensicAuditorService } from './services/forensicAuditorService.ts';
import { SingleChannelGenerator } from './components/SingleChannelGenerator.tsx';
import { AudioLab } from './components/AudioLab.tsx';
import { AudioRenderer } from './components/AudioRenderer.tsx';
import { SubtitleLab } from './components/SubtitleLab.tsx';
import { getEngineStats, engineProfileService, resolveGenreId } from './services/engineProfileService';

const GENRE_BPM_MAP: Record<MusicGenre, number> = {
    [MusicGenre.PSYTRANCE_FULLON]: 145,
    [MusicGenre.PSYTRANCE_POWER]: 142,
    [MusicGenre.GOA_TRANCE]: 148,
    [MusicGenre.MELODIC_TECHNO]: 126,
    [MusicGenre.TECHNO_PEAK]: 132
};

type ViewType = 'WELCOME' | 'CREATE' | 'STUDIO' | 'AUDIO_LAB' | 'SUBTITLE_LAB' | 'GENERATOR' | 'JOBS' | 'RENDERER';

const NAV_ORDER: ViewType[] = ['WELCOME', 'CREATE', 'STUDIO', 'AUDIO_LAB', 'SUBTITLE_LAB', 'GENERATOR', 'RENDERER', 'JOBS'];

export default function App() {
  const [view, setView] = useState<ViewType>('WELCOME');
  const [groove, setGroove] = useState<GrooveObject | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<ChannelKey[]>(SUPPORTED_CHANNELS);
  const [engineStats, setEngineStats] = useState(getEngineStats());
  
  const touchStart = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);
  const minSwipeDistance = 100; 

  const [params, setParams] = useState<GenerationParams>({
    genre: MusicGenre.PSYTRANCE_FULLON, 
    key: MusicalKey.F_SHARP, 
    scale: ScaleType.PHRYGIAN, 
    bpm: 145, 
    mode: 'NEW', 
    trackLengthMinutes: 6, 
    energyMode: EnergyMode.PEAK, 
    bpmMode: BpmMode.MANUAL
  });

  useEffect(() => {
    // Initialize Neurokinetic Drive by default
    if (!localStorage.getItem('NEUROKINETIC_DRIVE_ACTIVE')) {
        engineProfileService.setNeurokineticMode(true);
    }

    const unsub = jobQueueService.subscribe(() => {});
    const interval = setInterval(() => {
        const stats = getEngineStats();
        setEngineStats(stats);
    }, 2000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (view === 'STUDIO' && groove) {
        forensicAuditorService.observe(groove);
    }
  }, [groove, view]);

  const handleForceSync = () => {
      engineProfileService.syncEngineWithRecords();
      setEngineStats(getEngineStats());
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-swipe="true"]')) { touchStart.current = null; return; }
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    touchEnd.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current || !touchStartY.current || !touchEndY.current) return;
    const deltaX = touchStart.current - touchEnd.current;
    const deltaY = touchStartY.current - touchEndY.current;
    const isMainlyHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 2;
    const isLongEnough = Math.abs(deltaX) > minSwipeDistance;

    if (isLongEnough && isMainlyHorizontal) {
        const currentIndex = NAV_ORDER.indexOf(view);
        if (currentIndex === -1) return;
        if (deltaX > 0 && currentIndex < NAV_ORDER.length - 1) setView(NAV_ORDER[currentIndex + 1]);
        else if (deltaX < 0 && currentIndex > 0) setView(NAV_ORDER[currentIndex - 1]);
    }
    touchStart.current = null; touchEnd.current = null; touchStartY.current = null; touchEndY.current = null;
  };

  const handleOpenProjectInReview = (g: GrooveObject) => {
      setGroove(g);
      setView('STUDIO'); 
  };

  const handleGenreChange = (newGenre: MusicGenre) => {
      setParams({ ...params, genre: newGenre, bpm: GENRE_BPM_MAP[newGenre] || 140 });
  };

  // Get active engine profile for current selection
  const currentGenreId = resolveGenreId(params.genre);
  const currentGenreEngine = engineProfileService.getGenreEngineProfile(currentGenreId);
  const isNeurokinetic = engineProfileService.isNeurokineticActive();

  return (
    <div className="h-screen w-full bg-black text-white flex flex-col font-sans overflow-hidden select-none" dir="ltr" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <Navigation currentView={view} onChangeView={setView} />
      
      {/* Neurokinetic Status Bar */}
      <div className="bg-[#0A0A0C] border-b border-white/5 px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${isNeurokinetic ? 'bg-sky-500 animate-pulse' : 'bg-gray-600'}`} />
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Neurokinetic Drive <span className={isNeurokinetic ? 'text-sky-500' : ''}>{isNeurokinetic ? 'V120 ACTIVE' : 'OFF'}</span></span>
              </div>
              <div className="h-3 w-[1px] bg-white/10" />
              <div className="flex items-center gap-2">
                  <Database size={10} className="text-gray-500" />
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Knowledge Base: <span className="text-white">351 Units</span></span>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                  <ShieldCheck size={10} className="text-emerald-500" />
                  <span className="text-[8px] font-black uppercase text-emerald-500">Hybrid Mode</span>
              </div>
          </div>
      </div>

      <main className="flex-1 relative overflow-hidden">
        {view === 'WELCOME' && (
            <WelcomeScreen onEnter={() => setView('CREATE')} onOpenStudio={() => setView('STUDIO')} onOpenJobs={() => setView('JOBS')} onOpenGenerator={() => setView('GENERATOR')} onOpenAudioLab={() => setView('AUDIO_LAB')} onOpenSubtitleLab={() => setView('SUBTITLE_LAB')} onOpenRenderer={() => setView('RENDERER')} />
        )}
        {view === 'STUDIO' && <StudioPage initialGroove={groove} onUpdate={setGroove} onClose={() => setView('JOBS')} />}
        {view === 'JOBS' && <JobsCenterPage onOpenGroove={handleOpenProjectInReview} onClose={() => setView('WELCOME')} />}
        {view === 'GENERATOR' && <SingleChannelGenerator onClose={() => setView('WELCOME')} />}
        {view === 'AUDIO_LAB' && <AudioLab onClose={() => setView('WELCOME')} />}
        {view === 'SUBTITLE_LAB' && <SubtitleLab onClose={() => setView('WELCOME')} />}
        {view === 'RENDERER' && <AudioRenderer onClose={() => setView('WELCOME')} />}

        {view === 'CREATE' && (
            <div className="h-full flex flex-col items-center p-3 md:p-8 overflow-y-auto custom-scrollbar bg-gradient-to-b from-[#050505] to-black pb-20">
                <div className="max-w-4xl w-full bg-[#0a0a0c] p-5 md:p-10 rounded-2xl md:rounded-[2rem] border border-white/10 space-y-6 md:space-y-8 shadow-2xl relative">
                    
                    <header className="text-center space-y-2 mb-4 md:mb-8">
                        <h2 className="text-2xl md:text-5xl font-black uppercase tracking-tighter italic">Track <span className="text-sky-500">Generator</span></h2>
                        <p className="text-gray-500 text-[8px] md:text-[10px] font-mono uppercase tracking-[0.3em]">Select Style & Create</p>
                    </header>
                    
                    <div className="space-y-6 md:space-y-8">
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div className="bg-black p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5 space-y-2">
                                <label className="text-[8px] md:text-[9px] text-gray-500 font-bold uppercase tracking-widest">Genre</label>
                                <select value={params.genre} onChange={e => handleGenreChange(e.target.value as MusicGenre)} className="w-full bg-transparent font-black text-white outline-none appearance-none cursor-pointer text-base md:text-xl uppercase tracking-tight">
                                    {Object.values(MusicGenre).map(g => <option key={g} value={g} className="bg-black text-white">{g}</option>)}
                                </select>
                            </div>
                            <div className="bg-black p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5 flex items-center justify-between">
                                <div>
                                    <label className="text-[8px] md:text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Tempo</label>
                                    <div className="text-lg md:text-xl font-black text-sky-500 flex items-center gap-2">{params.bpm} <span className="text-xs md:text-sm text-gray-600">BPM</span></div>
                                </div>
                                <div className="p-2 md:p-3 bg-sky-500/10 rounded-full border border-sky-500/20">
                                    <Lock size={14} className="text-sky-500" />
                                </div>
                            </div>
                        </section>

                        <section className="grid grid-cols-2 gap-4 md:gap-6">
                            <div className="bg-black p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5 space-y-2">
                                <label className="text-[8px] md:text-[9px] text-gray-500 font-bold uppercase tracking-widest">Musical Key</label>
                                <select value={params.key} onChange={e => setParams({...params, key: e.target.value as MusicalKey})} className="w-full bg-transparent font-black text-white outline-none appearance-none cursor-pointer text-base md:text-xl uppercase tracking-tight">
                                    {Object.values(MusicalKey).map(k => <option key={k} value={k} className="bg-black text-white">{k}</option>)}
                                </select>
                            </div>
                            <div className="bg-black p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5 space-y-2">
                                <label className="text-[8px] md:text-[9px] text-gray-500 font-bold uppercase tracking-widest">Scale Mode</label>
                                <select value={params.scale} onChange={e => setParams({...params, scale: e.target.value as ScaleType})} className="w-full bg-transparent font-black text-white outline-none appearance-none cursor-pointer text-base md:text-xl uppercase tracking-tight">
                                    {Object.values(ScaleType).map(s => <option key={s} value={s} className="bg-black text-white">{s}</option>)}
                                </select>
                            </div>
                        </section>

                        <section className="bg-[#0E0E10] border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-8">
                            <label className="text-[9px] md:text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2 mb-4">Select Instruments <span className="text-sky-500">({selectedChannels.length})</span></label>
                            <ChannelSelector selectedChannels={selectedChannels} onChange={setSelectedChannels} />
                        </section>
                    </div>

                    <div className="pt-4 md:pt-8">
                        <button onClick={() => { jobQueueService.addMidiJob(params, selectedChannels); setView('JOBS'); }} disabled={selectedChannels.length === 0} className="w-full py-5 md:py-8 bg-white text-black rounded-xl md:rounded-[1.5rem] font-black uppercase text-lg md:text-2xl hover:bg-sky-500 hover:text-white disabled:opacity-50 transition-all duration-300 shadow-2xl flex items-center justify-center gap-3 md:gap-4 active:scale-[0.98]">
                            {selectedChannels.length === 0 ? "Select Instruments" : <><Zap size={20} className="md:w-6 md:h-6" fill="currentColor" /> Generate {selectedChannels.length} Tracks</>}
                        </button>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}
