import React from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

export const InstallPrompt: React.FC = () => {
  const { platform, canInstall, dismissed, install, dismiss } = usePwaInstall();

  if (!canInstall || dismissed || platform === 'standalone') return null;

  return (
    <div className="fixed inset-x-3 z-[7000] bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6 md:max-w-md md:left-auto md:right-6">
      <div className="rounded-2xl border border-sky-500/30 bg-[#0A0A0C]/95 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.65)] p-3.5 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black">
          <img src="/icons/icon-192.png" alt="MIDI AI" className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-wide text-white">Install MIDI AI</div>
          {platform === 'ios' ? (
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              Tap <Share size={12} className="inline -mt-0.5 text-sky-400" /> then
              <span className="text-white font-semibold"> Add to Home Screen </span>
              <PlusSquare size={12} className="inline -mt-0.5 text-sky-400" />
            </p>
          ) : (
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              Add the studio to your home screen and open it like a native app.
            </p>
          )}
          {platform !== 'ios' && (
            <button
              onClick={() => { void install(); }}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 text-black text-[10px] font-black uppercase tracking-widest"
            >
              <Download size={12} /> Install app
            </button>
          )}
        </div>
        <button onClick={dismiss} className="p-1 text-gray-500 hover:text-white shrink-0" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
