import React, { useEffect, useState } from 'react';
import { Home, Zap, Sliders, Layers, ListChecks } from 'lucide-react';
import { jobQueueService } from '../services/jobQueueService';

interface MobileTabBarProps {
  currentView: string;
  onChangeView: (view: string) => void;
}

const TABS = [
  { id: 'WELCOME', label: 'Home', icon: Home },
  { id: 'CREATE', label: 'Create', icon: Zap },
  { id: 'STUDIO', label: 'Studio', icon: Sliders },
  { id: 'TOOLS', label: 'Tools', icon: Layers, aliases: ['AUDIO_LAB', 'RENDERER', 'GENERATOR'] },
  { id: 'JOBS', label: 'Tasks', icon: ListChecks },
];

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ currentView, onChangeView }) => {
  const [jobsCount, setJobsCount] = useState(0);

  useEffect(() => {
    return jobQueueService.subscribe((jobs) => {
      setJobsCount(jobs.filter((job) => job.status === 'PROCESSING' || job.status === 'PENDING').length);
    });
  }, []);

  return (
    <nav
      className="md:hidden shrink-0 bg-[#08080A]/95 backdrop-blur-xl border-t border-white/10 z-[5000]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5 h-16">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id || tab.aliases?.includes(currentView);
          const badge = tab.id === 'JOBS' && jobsCount > 0 ? jobsCount : null;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeView(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? 'text-sky-400' : 'text-gray-500'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.6 : 2} />
              <span className="text-[9px] font-black uppercase tracking-wide">{tab.label}</span>
              {isActive && <span className="absolute top-1.5 w-1 h-1 rounded-full bg-sky-400" />}
              {badge && (
                <span className="absolute top-1.5 right-[22%] min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
