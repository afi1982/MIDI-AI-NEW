
import React from 'react';
import { GrooveObject, NoteEvent } from '../types';

interface GrooveGridProps {
  groove: GrooveObject;
  onUpdate?: (updatedGroove: GrooveObject) => void;
}

const getDefaultNoteForTrack = (trackName: string, existingEvents: NoteEvent[]): string => {
    // Fix: Handle the case where NoteEvent.note might be an array of strings (a chord)
    if (existingEvents && existingEvents.length > 0) {
        const note = existingEvents[0].note;
        return Array.isArray(note) ? note[0] : note;
    }
    const name = trackName.toLowerCase();
    if (name.includes('kick')) return 'C1';
    if (name.includes('bass')) return 'F#2'; 
    return 'C4';
};

const TrackRow: React.FC<{ name: string; events: NoteEvent[]; totalBars: number; onToggle: (time: string) => void; }> = ({ name, events, totalBars, onToggle }) => {
  const steps = totalBars * 16; 
  
  const getEventAt = (stepIndex: number) => {
      const beat = Math.floor(stepIndex / 4);
      const sixteenth = stepIndex % 4;
      const bar = Math.floor(beat / 4);
      const beatInBar = beat % 4;
      return events ? events.findIndex(e => {
          if (!e.time) return false;
          const parts = e.time.split(':').map(Number);
          return parts[0] === bar && parts[1] === beatInBar && Math.abs(parts[2] - sixteenth) < 0.25;
      }) : -1;
  };

  const gridCells = new Array(steps).fill(null).map((_, i) => {
      const beat = Math.floor(i / 4);
      const sixteenth = i % 4;
      const beatInBar = beat % 4;
      const bar = Math.floor(beat / 4);
      const cellTime = `${bar}:${beatInBar}:${sixteenth}`;
      const isBeat = sixteenth === 0;
      const eventIdx = getEventAt(i);
      const active = eventIdx !== -1;
      
      return (
           <div 
             key={i}
             onClick={() => onToggle(cellTime)}
             className={`
               h-8 w-6 mx-[1px] rounded-[1px] cursor-pointer transition-all duration-75 flex items-center justify-center shrink-0
               ${active ? 'bg-studio-accent shadow-[0_0_5px_rgba(0,245,255,0.6)]' : (isBeat ? 'bg-white/10' : 'bg-[#1A1A1E]')}
               hover:bg-white/20
             `}
           ></div>
      );
  });

  return (
    <div className="flex items-center mb-1">
      <div className="w-16 shrink-0 text-[9px] font-bold text-studio-dim uppercase tracking-wider truncate text-right pr-3">{name}</div>
      <div className="flex-1 flex overflow-visible">
        {gridCells}
      </div>
    </div>
  );
};

const GrooveGrid: React.FC<GrooveGridProps> = ({ groove, onUpdate }) => {
  if (!groove) return null;
  const tracks = ['kick', 'bass', 'lead', 'arp', 'pad', 'snare', 'clap', 'hihat', 'perc'];
  const maxBar = 8; 

  const handleToggle = (trackName: keyof GrooveObject, time: string) => {
      if (!onUpdate) return;
      const newGroove = JSON.parse(JSON.stringify(groove));
      const track = newGroove[trackName] as NoteEvent[];
      if (!Array.isArray(track)) return;
      
      const [tBar, tBeat, tSix] = time.split(':').map(Number);
      const idx = track.findIndex(e => {
          const p = e.time.split(':').map(Number);
          return p[0] === tBar && p[1] === tBeat && Math.abs(p[2] - tSix) < 0.25;
      });

      if (idx !== -1) track.splice(idx, 1);
      else track.push({ note: getDefaultNoteForTrack(trackName, track), duration: "16n", time, velocity: 0.9 });
      onUpdate(newGroove);
  };

  return (
    <div className="w-full overflow-x-auto hide-scrollbar touch-pan-x">
        <div className="flex justify-between items-center mb-4 px-1">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest">Sequencer Grid</h4>
            <div className="flex gap-4 text-[9px] text-studio-dim font-mono">
                <span>PHASE LOCK: ON</span>
                <span>QUANTIZE: 1/16</span>
            </div>
        </div>
        <div className="min-w-max pb-2">
            {tracks.map(t => (
                <TrackRow key={t} name={t} events={(groove as any)[t]} totalBars={maxBar} onToggle={(time) => handleToggle(t as any, time)} />
            ))}
        </div>
    </div>
  );
};

export default GrooveGrid;
