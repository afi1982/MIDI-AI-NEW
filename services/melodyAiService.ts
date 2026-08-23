import { GoogleGenAI, Type } from '@google/genai';
import { NoteEvent } from '../types';
import { sliceAudio } from './audioAnalysisService';
import { mapAiNotes, enforceMonophony, isSprayResponse, msToTick } from './melodyAiMapping';

/**
 * AI melody transcription.
 *
 * The hand-written DSP tracker works on clean material but struggles on dense
 * modern productions (layered supersaws, heavy reverb, sidechain), where the
 * lead shares every partial with the pad and the arp. A large audio model hears
 * those mixes far better than harmonic-salience maths does.
 *
 * Design rules:
 *  - the DSP still owns tempo and key (it is reliable and deterministic)
 *  - the model only answers "which note sounds when" for the main melody
 *  - every response is validated and clamped; a bad/absent answer for a chunk
 *    falls back to the DSP notes for that time range, so output never regresses
 *    to nothing.
 */

const CHUNK_SEC = 12;

export interface AiMelodyOptions {
  bpm: number;
  /** Notes from the local DSP engine, used to fill any chunk the model fails on. */
  fallbackNotes?: NoteEvent[];
  /** Expected register from the DSP pass - used to fix octave answers. */
  medianMidi?: number;
  onProgress?: (p: number) => void;
  signal?: { cancelled?: boolean };
}

export interface AiMelodyResult {
  notes: NoteEvent[];
  chunksTotal: number;
  chunksFromAi: number;
  chunksFromFallback: number;
  errors: string[];
}

const noteSchema = {
  type: Type.OBJECT,
  properties: {
    n: { type: Type.STRING, description: 'Pitch in scientific notation, e.g. F#4.' },
    t_ms: { type: Type.NUMBER, description: 'Start time in ms from the beginning of THIS excerpt.' },
    dur_ms: { type: Type.NUMBER, description: 'Duration in ms.' },
    v: { type: Type.NUMBER, description: 'Loudness 0.1-1.0.' },
  },
  required: ['n', 't_ms', 'dur_ms'],
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    has_melody: { type: Type.BOOLEAN, description: 'False if no lead melody is audible in this excerpt.' },
    instrument: { type: Type.STRING, description: 'What carries the melody: vocal, synth lead, pluck, none.' },
    notes: { type: Type.ARRAY, items: noteSchema },
  },
  required: ['has_melody', 'notes'],
};

export function hasAiKey(): boolean {
  try {
    return !!(process.env.API_KEY && String(process.env.API_KEY).length > 8);
  } catch {
    return false;
  }
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const buildPrompt = (index: number, bpm: number) => `You are transcribing the MAIN MELODY of a piece of music, one excerpt at a time.

This is excerpt #${index + 1}. The track runs at ${Math.round(bpm)} BPM.

WHAT TO TRANSCRIBE
- Only the single most prominent melodic line: the vocal, the lead synth, or the hook.
- Follow it note by note, exactly as performed.

WHAT TO IGNORE
- Drums, percussion, bass line, sub bass.
- Pads and sustained background chords.
- Repetitive 16th-note arpeggios that sit UNDER the melody.
- Reverb and delay tails: a repeat of a note is not a new note.

RULES
- MONOPHONIC: one note at a time, no overlaps. A note ends when the next begins.
- t_ms is measured from the start of THIS excerpt (0 = first sample).
- Use real pitches with octaves (e.g. "A4"), matching what you hear - do not transpose.
- If a section is instrumental-only with no lead line, set has_melody=false and return an empty list.
- Prefer fewer, correct notes over many uncertain ones. Do NOT invent filler.
- Typical melodies have 4-30 notes in ${CHUNK_SEC} seconds. Hundreds of tiny notes means you are tracking an arpeggio or reverb - do not.`;

export async function transcribeMelodyWithAI(file: File, options: AiMelodyOptions): Promise<AiMelodyResult> {
  const { bpm, onProgress, fallbackNotes = [], medianMidi } = options;
  const errors: string[] = [];

  if (!hasAiKey()) {
    throw new Error('AI_KEY_MISSING');
  }

  onProgress?.(5);
  const { chunks } = await sliceAudio(file, CHUNK_SEC, (p) => onProgress?.(Math.min(25, p)));
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const models = ['gemini-3-pro-preview', 'gemini-3-flash-preview'];

  const perChunk: NoteEvent[][] = new Array(chunks.length).fill(null).map(() => []);
  let fromAi = 0;
  let fromFallback = 0;

  for (let i = 0; i < chunks.length; i++) {
    if (options.signal?.cancelled) break;
    const chunk = chunks[i];
    const offsetSec = i * CHUNK_SEC;

    if (chunk.isSilent) { fromAi++; continue; }

    let handled = false;
    const base64 = await blobToBase64(chunk.blob);

    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              { inlineData: { data: base64, mimeType: 'audio/wav' } },
              { text: buildPrompt(i, bpm) },
            ],
          },
          config: { responseMimeType: 'application/json', responseSchema, temperature: 0 },
        });

        const parsed = JSON.parse(response.text || '{}');
        const raw = Array.isArray(parsed.notes) ? parsed.notes : [];

        // Guard against the model spraying notes (the failure mode we fought in DSP)
        if (isSprayResponse(raw.length, CHUNK_SEC)) {
          errors.push(`chunk ${i}: model returned ${raw.length} notes, treating as unreliable`);
          break;
        }
        perChunk[i] = mapAiNotes(raw, offsetSec, bpm, medianMidi);
        handled = true;
        fromAi++;
        break;
      } catch (err: any) {
        const msg = err?.message || String(err);
        errors.push(`chunk ${i} (${model}): ${msg}`);
        if (/API key|PERMISSION|UNAUTHENTICATED/i.test(msg)) throw new Error('AI_KEY_INVALID');
      }
    }

    if (!handled) {
      const from = msToTick(offsetSec * 1000, bpm);
      const to = msToTick((offsetSec + CHUNK_SEC) * 1000, bpm);
      perChunk[i] = fallbackNotes.filter((n) => (n.startTick || 0) >= from && (n.startTick || 0) < to);
      fromFallback++;
    }

    onProgress?.(25 + Math.round(((i + 1) / chunks.length) * 70));
  }

  const notes = enforceMonophony(perChunk.flat());
  onProgress?.(100);

  console.log('[AI melody]', { chunks: chunks.length, fromAi, fromFallback, notes: notes.length, errors: errors.slice(0, 4) });
  return { notes, chunksTotal: chunks.length, chunksFromAi: fromAi, chunksFromFallback: fromFallback, errors };
}

export { mapAiNotes, enforceMonophony, isSprayResponse, msToTick } from './melodyAiMapping';
