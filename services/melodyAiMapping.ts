import { NoteEvent } from '../types';
import { theoryEngine } from './theoryEngine';

/**
 * Pure transformations applied to the AI transcription response.
 * Kept free of any SDK import so they can be unit tested offline.
 */

export const PPQ = 480;

/** A melody has a handful of notes per second; more than that is an arp or reverb. */
export const isSprayResponse = (noteCount: number, chunkSec: number) => noteCount > chunkSec * 12;

export const msToTick = (ms: number, bpm: number) => Math.round((ms * bpm * PPQ) / 60000);

export function mapAiNotes(raw: any[], offsetSec: number, bpm: number, medianMidi?: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (const r of raw || []) {
    if (!r || typeof r.n !== 'string') continue;
    let midi = theoryEngine.getMidiNote(r.n);
    if (!Number.isFinite(midi) || midi < 24 || midi > 108) continue;
    if (!/^[A-Ga-g][#b]?-?\d/.test(r.n.trim())) continue;

    // The model sometimes answers an octave off; pull it into the register the
    // DSP measured for this song.
    if (typeof medianMidi === 'number' && medianMidi > 0) {
      while (midi - medianMidi > 9) midi -= 12;
      while (medianMidi - midi > 9) midi += 12;
    }

    const startTick = msToTick(offsetSec * 1000 + Math.max(0, r.t_ms || 0), bpm);
    const durTicks = Math.max(60, msToTick(Math.max(40, r.dur_ms || 200), bpm));
    out.push({
      note: theoryEngine.midiToNote(midi),
      duration: 'custom',
      durationTicks: durTicks,
      startTick,
      time: `${Math.floor(startTick / 1920)}:${Math.floor((startTick % 1920) / 480)}:${Math.floor((startTick % 480) / 120)}`,
      velocity: Math.max(0.25, Math.min(1, r.v ?? 0.85)),
    } as NoteEvent);
  }
  return out.sort((a, b) => (a.startTick || 0) - (b.startTick || 0));
}

/** Removes overlaps so the line stays a single voice. */
export function enforceMonophony(notes: NoteEvent[]): NoteEvent[] {
  const sorted = [...notes].sort((a, b) => (a.startTick || 0) - (b.startTick || 0));
  const out: NoteEvent[] = [];
  for (const n of sorted) {
    const prev = out[out.length - 1];
    if (prev) {
      const prevStart = prev.startTick || 0;
      const start = n.startTick || 0;
      if (start <= prevStart) continue; // duplicate onset
      const prevEnd = prevStart + (prev.durationTicks || 0);
      if (prevEnd > start) prev.durationTicks = Math.max(40, start - prevStart);
    }
    out.push({ ...n });
  }
  return out;
}
