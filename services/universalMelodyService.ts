
import { NoteEvent } from '../types';
import { melodicComposer } from './melodicComposer';

export const universalMelodyService = {
  generateTrack(params: {
    totalMinutes: number;
    root: number;
    scale: number[];
    genre: string;
    role: 'MAIN' | 'SUPPORT';
  }): NoteEvent[] {
    const { totalMinutes, root, scale, genre, role } = params;
    const bpm = 145; // Default for Psytrance
    const barsPerMinute = bpm / 4;
    const totalBars = Math.ceil(totalMinutes * barsPerMinute);
    
    const allEvents: NoteEvent[] = [];
    const motif = melodicComposer.createMotif(16, 12, genre);
    
    for (let bar = 0; bar < totalBars; bar++) {
      const barEvents = melodicComposer.generateBar(
        bar,
        root,
        scale,
        role === 'MAIN' ? 'LEAD' : 'ARP',
        motif,
        false,
        'COMPLEX',
        genre
      );
      allEvents.push(...barEvents);
    }
    
    return allEvents;
  }
};
