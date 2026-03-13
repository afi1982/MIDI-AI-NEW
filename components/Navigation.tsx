
import React, { useEffect, useState, useRef } from 'react';
import { Home, Zap, Sliders, ListChecks, AudioWaveform, Music, Activity, FileAudio, Cpu, FileText } from 'lucide-react';
import { jobQueueService } from '../services/jobQueueService';
import { getEngineStats, engineProfileService } from '../services/engineProfileService';

interface NavigationProps {
  currentView: string;
  onChangeView: (view: any) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, onChangeView }) => {
  const [jobsCount, setJobsCount] = useState(0);
  const [engineCount, setEngineCount] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const unsub = jobQueueService.subscribe((jobs) => {
      const active = jobs.filter(j => j.status === 'PROCESSING' || j.status === 'PENDING').length;
      setJobsCount(active);
    });
    
    const updateEngineCount = () => {
        // Force refresh from storage
        const stats = getEngineStats();
        setEngineCount(stats.total);
    };

    updateEngineCount();
    const interval = setInterval(updateEngineCount, 2000);

    return () => {
        unsub();
        clearInterval(interval);
    };
  }, []);

  const navItems = [
    { id: 'WELCOME', label: 'Home', icon: Home },
    { id: 'CREATE', label: 'Generator', icon: Zap },
    { id: 'STUDIO', label: 'Studio', icon: Sliders },
    { id: 'AUDIO_LAB', label: 'Audio to MIDI', icon: AudioWaveform },
    { id: 'SUBTITLE_LAB', label: 'Subtitle Lab', icon: FileText },
    { id: 'RENDERER', label: 'MIDI to Audio', icon: FileAudio },
    { id: 'GENERATOR', label: 'Loop Generator', icon: Music },
    { id: 'JOBS', label: 'Tasks', icon: ListChecks, badge: jobsCount > 0 ? jobsCount : null },
  ];

  return (
    <header className="h-16 shrink-0 bg-[#08080A] border-b border-white/10 flex items-center justify-between px-4 md:px-6 relative z-[5000] shadow-lg">
      <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => onChangeView('WELCOME')}>
        <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(2,132,199,0.4)]">
            <Activity className="text-white w-5 h-5" />
        </div>
        <div className="flex flex-col leading-none hidden md:flex">
            <span className="text-lg font-black tracking-tighter text-white italic">MIDI <span className="text-sky-500">AI</span></span>
            <span className="text-[8px] text-gray-500 font-mono tracking-widest uppercase">Elite AI Engine</span>
        </div>
      </div>

      <nav ref={navRef} className="flex items-center gap-1 md:gap-2 overflow-x-auto no-scrollbar mx-4 h-full scroll-smooth">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          
          return (
            <button 
                key={item.id} 
                ref={isActive ? activeTabRef : null}
                onClick={() => onChangeView(item.id)} 
                className={`
                    relative flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition-all duration-200 group whitespace-nowrap shrink-0
                    ${isActive ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}
                `}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors ${isActive ? 'text-sky-400' : 'group-hover:text-gray-300'}`} />
              <span className={`text-[10px] md:text-xs font-bold uppercase tracking-wider ${isActive ? 'text-white' : ''}`}>
                  {item.label}
              </span>
              {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-sky-500 rounded-full shadow-[0_0_10px_rgba(14,165,233,0.8)]"></div>
              )}
              {item.badge && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-[#08080A]">
                      {item.badge}
                  </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 shrink-0 ml-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-500 ${engineCount > 0 ? 'bg-purple-600/20 border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-white/5 border-white/10 text-gray-600'}`}>
              <div className="relative">
                <Cpu size={16} className={engineCount > 0 ? 'animate-pulse' : ''} />
                {engineCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-ping"></span>}
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[10px] font-black font-mono">{engineCount}</span>
                <span className="text-[6px] font-bold uppercase tracking-tighter">Units</span>
              </div>
          </div>
      </div>
    </header>
  );
};
