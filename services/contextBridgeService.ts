
import { EliteAudioObject, MusicalGenreContext, MoodContext, InstrumentRole, ContextEnvelope } from '../types';

export const GROOVE_PRESETS: Record<MusicalGenreContext, any> = {
  'Jazz': { swingAmount: 0.65, humanizeTimingMs: 20, velocityRange: [40, 95] },
  'Trap': { swingAmount: 0, humanizeTimingMs: 5, velocityRange: [90, 127] },
  'Techno': { swingAmount: 0, humanizeTimingMs: 0, velocityRange: [110, 120] },
  'LoFi': { swingAmount: 0.4, humanizeTimingMs: 35, velocityRange: [50, 85] },
  'Cinematic': { swingAmount: 0.1, humanizeTimingMs: 45, velocityRange: [30, 110] },
  'Psytrance': { swingAmount: 0, humanizeTimingMs: 10, velocityRange: [80, 115] }
};

export class ContextBridgeService {
  /**
   * Enriches raw MIDI data with semantic context.
   * // Fix: Changed from static to public instance method to support instance-based access
   */
  public enrichMidi(
    midiData: any[], 
    genre: MusicalGenreContext, 
    mood: MoodContext, 
    role: InstrumentRole,
    bpm: number,
    musicalKey: { root: string; scale: string }
  ): EliteAudioObject {
    const preset = GROOVE_PRESETS[genre] || GROOVE_PRESETS['Psytrance'];
    
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      rawData: midiData,
      context: {
        genre,
        mood,
        role,
        bpm,
        musicalKey,
        suggestedGroove: preset
      }
    };
  }

  /**
   * Applies automatic forensic correction based on the Context Envelope.
   * // Fix: Changed from static to public instance method to support instance-based access
   */
  public autoCorrect(eliteObject: EliteAudioObject): any[] {
    const { genre, mood, role, suggestedGroove } = eliteObject.context;
    let processed = JSON.parse(JSON.stringify(eliteObject.rawData));

    // Logic A: Micro-Timing & Quantization
    const swing = suggestedGroove?.swingAmount || 0;
    const humanize = suggestedGroove?.humanizeTimingMs || 0;

    processed = processed.map((note: any) => {
      // Apply Humanize / Jitter
      const jitter = (Math.random() - 0.5) * humanize;
      const originalTick = note.s * 120; // Simplified step to tick
      
      // Techno - Strict Grid
      if (genre === 'Techno') {
        // No change, strict quantization is default
      } 
      // Jazz - Swing Ratio
      else if (genre === 'Jazz' || genre === 'LoFi') {
        const isOffbeat = note.s % 2 !== 0;
        if (isOffbeat) {
          note.s_offset = (note.s_offset || 0) + (swing * 40) + jitter;
        }
      }
      
      // Logic B: Velocity Dynamics
      let vel = note.v;
      
      // Downbeat boost (+15%)
      if (note.s % 4 === 0) vel *= 1.15;
      
      // Ghost notes in Melancholic mood
      if (mood === 'Melancholic' && note.s % 4 !== 0) vel *= 0.6;
      
      // Role specific overrides
      if (role === 'Drums_HiHat' && genre === 'Trap') {
        // Trap HiHats often need specific patterns (Retrigger logic)
        // Simulated here by ensuring high velocity
        vel = Math.max(vel, 0.9);
      }

      return { ...note, v: Math.min(1.0, vel) };
    });

    return processed;
  }
}

export const contextBridge = new ContextBridgeService();
