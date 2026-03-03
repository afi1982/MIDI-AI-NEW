
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GrooveObject, NoteEvent, ChannelKey } from '../types';
import { Volume2, VolumeX, Waves, GripVertical, FileMusic, Copy, Trash2 } from 'lucide-react';
import { audioService } from '../services/audioService';
import { importMidiNotesToTrack } from '../services/midiService';

interface StudioArrangementProps {
  groove: GrooveObject;
  activeTrack: string | null;
  onSelectTrack: (track: string, tick?: number) => void;
  playbackTime: number; 
  onSeek: (time: number) => void;
  onUpdateTrack: (track: string, notes: NoteEvent[]) => void;
  onSampleLoad?: () => void; // New callback for audio engine refresh
  showSidebar: boolean;
  pixelsPerBar?: number;
  setTimelineZoom?: React.Dispatch<React.SetStateAction<number>>;
}

const ALL_CHANNELS: ChannelKey[] = [
  'ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch4_leadA', 'ch5_leadB',
  'ch6_arpA', 'ch7_arpB', 'ch8_snare', 'ch9_clap', 'ch10_percLoop',
  'ch11_percTribal', 'ch12_hhClosed', 'ch13_hhOpen', 'ch14_acid', 'ch15_pad', 'ch16_synth'
];

const TRACK_COLORS: Record<string, string> = {
    'ch1_kick': '#FF4E4E', 'ch2_sub': '#FFB344', 'ch3_midBass': '#EBC144',
    'ch4_leadA': '#4487F2', 'ch5_leadB': '#5A9CF2', 'ch6_arpA': '#D944F2',
    'ch7_arpB': '#A344F2', 'ch8_snare': '#44F27B', 'ch9_clap': '#44F244',
    'ch10_percLoop': '#44F2DB', 'ch11_percTribal': '#44DBF2', 'ch12_hhClosed': '#9BF244',
    'ch13_hhOpen': '#B8F244', 'ch14_acid': '#F244A3', 'ch15_pad': '#6644F2', 'ch16_synth': '#F244E0'
};

const ROW_HEIGHT = window.innerWidth < 768 ? 74 : 84;
const TICKS_PER_BAR = 1920;

const getChannelDisplayName = (key: string): string => {
    if (!key) return "TRACK";
    const parts = key.split('_');
    if (parts.length > 1) {
        let rawName = parts.slice(1).join(' ');
        return rawName.replace(/([A-Z])/g, ' $1').toUpperCase().trim();
    }
    return key.toUpperCase();
};

export const StudioArrangement: React.FC<StudioArrangementProps> = ({ groove, activeTrack, onSelectTrack, playbackTime, onUpdateTrack, onSampleLoad, showSidebar, pixelsPerBar = 120 }) => {
  const scrollRef = useRef<HTMLDivElement>(null); 
  const sidebarRef = useRef<HTMLDivElement>(null); 
  const rulerRef = useRef<HTMLDivElement>(null);
  
  const [mutedTracks, setMutedTracks] = useState<Set<string>>(new Set());
  const [loadingTrack, setLoadingTrack] = useState<string | null>(null);
  
  const [sidebarWidth, setSidebarWidth] = useState(window.innerWidth < 768 ? 130 : 180);
  const isResizing = useRef(false);

  const startResizing = useCallback((e: any) => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
  }, []);

  const resize = useCallback((e: any) => {
    if (!isResizing.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const newWidth = Math.min(Math.max(80, clientX), 400); 
    setSidebarWidth(newWidth);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    window.addEventListener('touchmove', resize);
    window.addEventListener('touchend', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', resize);
      window.removeEventListener('touchend', stopResizing);
    };
  }, [resize, stopResizing]);

  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
      if (rulerRef.current) rulerRef.current.scrollLeft = e.currentTarget.scrollLeft;
      if (sidebarRef.current) sidebarRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  const handleSidebarScroll = (e: React.UIEvent<HTMLDivElement>) => {
      if (scrollRef.current) scrollRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  const totalBars = Math.max(groove?.totalBars || 128, 128);
  const totalWidth = totalBars * pixelsPerBar;

  const toggleMute = (e: React.MouseEvent, key: string) => {
      e.stopPropagation();
      const newMuted = new Set(mutedTracks);
      if (newMuted.has(key)) {
          newMuted.delete(key);
          audioService.setChannelMute(key, false);
      } else {
          newMuted.add(key);
          audioService.setChannelMute(key, true);
      }
      setMutedTracks(newMuted);
  };

  const handleImportMidiToTrack = async (e: React.ChangeEvent<HTMLInputElement>, trackKey: string) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setLoadingTrack(trackKey);
      try {
          const newNotes = await importMidiNotesToTrack(file);
          const currentNotes = (groove as any)[trackKey] || [];
          onUpdateTrack(trackKey, [...currentNotes, ...newNotes]);
      } catch (err) {
          alert("MIDI Signal Error: " + err);
      } finally {
          setLoadingTrack(null);
          e.target.value = '';
      }
  };

  const handleLoadSampleToTrack = async (e: React.ChangeEvent<HTMLInputElement>, trackKey: string) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setLoadingTrack(trackKey);
      try {
          await audioService.loadCustomSample(trackKey, file);
          if (onSampleLoad) onSampleLoad(); // Trigger engine refresh in parent
      } catch (err) {
          alert("Sample Processing Error: " + err);
      } finally {
          setLoadingTrack(null);
          e.target.value = '';
      }
  };

  const getClipsForTrack = (trackKey: string) => {
      const notes = (groove as any)[trackKey] as NoteEvent[] || [];
      if (notes.length === 0) return [];
      const groupedClips: { startBar: number, durationBars: number, notes: NoteEvent[] }[] = [];
      const sortedNotes = [...notes].sort((a,b) => (a.startTick || 0) - (b.startTick || 0));
      let currentClip: { startBar: number, durationBars: number, notes: NoteEvent[] } | null = null;
      sortedNotes.forEach(n => {
          const tick = n.startTick || 0;
          const bar = Math.floor(tick / TICKS_PER_BAR);
          if (!currentClip || bar >= currentClip.startBar + currentClip.durationBars + 2) {
              if (currentClip) groupedClips.push(currentClip);
              currentClip = { startBar: bar, durationBars: 8, notes: [n] };
          } else {
              currentClip.notes.push(n);
              const endBar = Math.ceil((tick + (n.durationTicks || 120)) / TICKS_PER_BAR);
              currentClip.durationBars = Math.max(currentClip.durationBars, endBar - currentClip.startBar);
          }
      });
      if (currentClip) groupedClips.push(currentClip);
      return groupedClips;
  };

  const handleDuplicateClip = (e: React.MouseEvent, trackKey: string, clip: { startBar: number, durationBars: number, notes: NoteEvent[] }) => {
      e.stopPropagation();
      const offsetTicks = clip.durationBars * TICKS_PER_BAR;
      const duplicatedNotes = clip.notes.map(n => {
          const newTick = (n.startTick || 0) + offsetTicks;
          const bar = Math.floor(newTick / TICKS_PER_BAR);
          const beat = Math.floor((newTick % TICKS_PER_BAR) / 480);
          const sixteen = Math.floor((newTick % 480) / 120);
          return { ...n, startTick: newTick, time: `${bar}:${beat}:${sixteen}` };
      });
      const allTrackNotes = (groove as any)[trackKey] as NoteEvent[] || [];
      onUpdateTrack(trackKey, [...allTrackNotes, ...duplicatedNotes]);
  };

  const handleDeleteClip = (e: React.MouseEvent, trackKey: string, clip: { startBar: number, durationBars: number, notes: NoteEvent[] }) => {
      e.stopPropagation();
      const allTrackNotes = (groove as any)[trackKey] as NoteEvent[] || [];
      const startTick = clip.startBar * TICKS_PER_BAR;
      const endTick = (clip.startBar + clip.durationBars) * TICKS_PER_BAR;
      const filtered = allTrackNotes.filter(n => (n.startTick || 0) < startTick || (n.startTick || 0) >= endTick);
      onUpdateTrack(trackKey, filtered);
  };

  const computedSidebarWidth = showSidebar ? sidebarWidth : 0;

  return (
    <div className="flex flex-col h-full bg-[#050506] text-[#A1A1A2] overflow-hidden border-t border-white/5">
        <div className="h-10 flex shrink-0 border-b border-black bg-[#0A0A0C]">
            <div 
              style={{ width: `${computedSidebarWidth}px` }} 
              className={`shrink-0 border-r border-black flex items-center px-4 bg-[#0A0A0C] z-20 overflow-hidden transition-all duration-300`}
            >
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest whitespace-nowrap">Channels</span>
            </div>
            <div className="flex-1 overflow-hidden relative" ref={rulerRef} data-no-swipe="true">
                <div className="h-full relative" style={{ width: totalWidth }}>
                    {Array.from({ length: totalBars }).map((_, i) => (
                        i % 4 === 0 && (
                            <div key={i} className="absolute top-0 bottom-0 border-l border-white/10 pl-1" style={{ left: i * pixelsPerBar }}>
                                <span className="text-[8px] font-mono opacity-30">{i + 1}</span>
                            </div>
                        )
                    ))}
                </div>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
            <div 
              ref={sidebarRef}
              onScroll={handleSidebarScroll}
              style={{ width: `${computedSidebarWidth}px` }}
              className={`shrink-0 z-20 bg-[#0F0F12] border-r border-black overflow-y-auto no-scrollbar transition-all duration-300 relative`}
              data-no-swipe="true"
            >
                {ALL_CHANNELS.map((key) => (
                    <div 
                        key={key} 
                        onClick={() => onSelectTrack(key)} 
                        style={{ height: `${ROW_HEIGHT}px` }} 
                        className={`flex flex-col justify-center px-3 border-b border-white/5 cursor-pointer transition-colors relative ${activeTrack === key ? 'bg-sky-500/10' : 'hover:bg-white/[0.02]'}`}
                    >
                        <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all ${activeTrack === key ? 'bg-sky-500 shadow-[0_0_8px_#0ea5e9]' : 'bg-transparent'}`}></div>

                        <div className="flex flex-col gap-1 w-full min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-1.5 h-4 md:h-6 rounded-full shrink-0" style={{ backgroundColor: TRACK_COLORS[key] }}></div>
                                <div className="flex flex-col min-w-0 overflow-hidden">
                                    <span className={`text-[10px] md:text-[13px] font-black uppercase tracking-tight leading-tight block truncate ${activeTrack === key ? 'text-white' : 'text-zinc-100'}`}>
                                      {getChannelDisplayName(key)}
                                    </span>
                                    <span className="text-[7px] text-gray-500 font-mono font-bold leading-none">{key.split('_')[0].toUpperCase()}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5 mt-2">
                                {loadingTrack === key ? (
                                    <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <div className="flex gap-1.5">
                                        <label className="p-1.5 rounded bg-black border border-white/10 hover:bg-sky-500/20 hover:text-sky-400 text-gray-400 cursor-pointer transition-all" title="Load Audio Sample">
                                            <Waves size={13} />
                                            <input type="file" className="hidden" accept="audio/*" onChange={(e) => handleLoadSampleToTrack(e, key)} />
                                        </label>
                                        <label className="p-1.5 rounded bg-black border border-white/10 hover:bg-purple-500/20 hover:text-purple-400 text-gray-400 cursor-pointer transition-all" title="Import MIDI Clip">
                                            <FileMusic size={13} />
                                            <input type="file" className="hidden" accept=".mid,.midi" onChange={(e) => handleImportMidiToTrack(e, key)} />
                                        </label>
                                    </div>
                                )}
                                <button 
                                    onClick={(e) => toggleMute(e, key)} 
                                    className={`ml-auto p-1.5 rounded transition-all border ${mutedTracks.has(key) ? 'text-red-500 bg-red-500/10 border-red-500/30' : 'text-gray-400 hover:text-white bg-black border-white/10'}`}
                                >
                                    {mutedTracks.has(key) ? <VolumeX size={13} /> : <Volume2 size={13} />}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {computedSidebarWidth > 0 && (
              <div 
                onMouseDown={startResizing}
                onTouchStart={startResizing}
                className="absolute top-0 bottom-0 w-1.5 z-30 cursor-col-resize hover:bg-sky-500/50 transition-colors flex items-center justify-center group"
                style={{ left: `${computedSidebarWidth - 1}px` }}
              >
                <div className="w-[1px] h-full bg-white/5 group-hover:bg-sky-400"></div>
                <div className="absolute w-4 h-8 bg-black/80 border border-white/10 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical size={10} className="text-gray-400" />
                </div>
              </div>
            )}

            <div ref={scrollRef} onScroll={handleTimelineScroll} className="flex-1 overflow-auto bg-[#050506] relative custom-scrollbar scroll-smooth" data-no-swipe="true">
                <div className="relative" style={{ width: totalWidth, height: ALL_CHANNELS.length * ROW_HEIGHT }}>
                    <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)`, backgroundSize: `${pixelsPerBar}px ${ROW_HEIGHT}px` }}></div>

                    {ALL_CHANNELS.map(trackKey => (
                        <div key={trackKey} style={{ height: `${ROW_HEIGHT}px` }} className="relative w-full border-b border-white/5 group">
                            {getClipsForTrack(trackKey).map((clip, idx) => (
                                <div key={idx} onClick={() => onSelectTrack(trackKey, clip.startBar * TICKS_PER_BAR)} className={`absolute top-1.5 bottom-1.5 rounded-lg border border-white/10 cursor-pointer transition-all hover:ring-2 hover:ring-white/20 active:scale-[0.98] overflow-hidden ${activeTrack === trackKey ? 'ring-1 ring-sky-500 shadow-2xl' : ''}`} style={{ left: clip.startBar * pixelsPerBar, width: clip.durationBars * pixelsPerBar, backgroundColor: `${TRACK_COLORS[trackKey]}33` }}>
                                    <div className="h-5 bg-black/50 flex items-center justify-between px-2 border-b border-white/5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[7px] font-black uppercase text-gray-300">CLIP</span>
                                            <span className="text-[7px] font-mono text-sky-400">{clip.durationBars}b</span>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button onClick={(e) => handleDuplicateClip(e, trackKey, clip)} className="p-0.5 hover:text-sky-400"><Copy size={12} /></button>
                                            <button onClick={(e) => handleDeleteClip(e, trackKey, clip)} className="p-0.5 hover:text-red-500"><Trash2 size={12} /></button>
                                        </div>
                                    </div>
                                    <div className="flex-1 relative pointer-events-none opacity-40 p-2 overflow-hidden">
                                        {clip.notes.slice(0, 30).map((n, i) => (
                                            <div key={i} className="absolute h-0.5 bg-white rounded-full shadow-[0_0_4px_white]" style={{ left: (((n.startTick || 0) % (clip.durationBars * TICKS_PER_BAR)) / (clip.durationBars * TICKS_PER_BAR)) * 100 + '%', top: (i * 3.5) % (ROW_HEIGHT - 35) + 'px', width: '3px' }} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}

                    <div className="absolute top-0 bottom-0 w-0.5 bg-sky-400 z-50 pointer-events-none shadow-[0_0_15px_rgba(56,189,248,1)]" style={{ left: (playbackTime * ((groove.bpm || 145)/60) / 4) * pixelsPerBar }}>
                        <div className="w-4 h-4 -ml-2 bg-sky-400 rounded-full border-2 border-white"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
