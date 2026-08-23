
import { GoogleGenAI, Type } from "@google/genai";
import { GrooveObject, NoteEvent, ChannelKey } from '../types';
import { ELITE_16_CHANNELS } from './maestroService';
import { theoryEngine } from './theoryEngine';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); 
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numOfChan = 1; 
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channel = buffer.getChannelData(0);
    let sample, offset = 0;
    
    const writeString = (s: string) => {
        for (let i = 0; i < s.length; i++) out.setUint8(offset + i, s.charCodeAt(i));
        offset += s.length;
    };

    writeString('RIFF');
    out.setUint32(offset, length - 8, true); offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    out.setUint32(offset, 16, true); offset += 4;
    out.setUint16(offset, 1, true); offset += 2;
    out.setUint16(offset, numOfChan, true); offset += 2;
    out.setUint32(offset, buffer.sampleRate, true); offset += 4;
    out.setUint32(offset, buffer.sampleRate * 2 * numOfChan, true); offset += 4;
    out.setUint16(offset, 2 * numOfChan, true); offset += 2;
    out.setUint16(offset, 16, true); offset += 2;
    writeString('data');
    out.setUint32(offset, length - offset - 4, true); offset += 4;

    for (let i = 0; i < buffer.length; i++) {
        sample = Math.max(-1, Math.min(1, channel[i]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        out.setInt16(offset, sample, true);
        offset += 2;
    }

    return new Blob([out], { type: 'audio/wav' });
};

const preciseNoteSchema = {
    type: Type.OBJECT,
    properties: {
        n: { type: Type.STRING, description: "Pitch (e.g. F#3)." },
        t_ms: { type: Type.NUMBER, description: "Start time in ms from segment start." },
        dur_ms: { type: Type.NUMBER, description: "Duration in ms." },
        v: { type: Type.NUMBER, description: "Velocity (0.1-1.0) mapping RMS energy." },
        pb: { type: Type.NUMBER, description: "Pitch Bend (-8192 to 8191) to capture microtonal fluctuations." }
    },
    required: ["n", "t_ms", "dur_ms", "v"]
};

const hitSchema = {
    type: Type.OBJECT,
    properties: {
        t_ms: { type: Type.NUMBER, description: "Hit start time in ms from segment start." },
        v: { type: Type.NUMBER, description: "Velocity (0.1-1.0) mapping the transient energy." }
    },
    required: ["t_ms", "v"]
};

const rawTranscriptionSchema = {
  type: Type.OBJECT,
  properties: {
    detected_bpm: { type: Type.NUMBER },
    lead: { type: Type.ARRAY, items: preciseNoteSchema }
  },
  required: ["detected_bpm", "lead"]
};

/**
 * FULL BAND schema: every instrument family gets its own array so the song is
 * separated into real channels instead of one mono lead.
 */
const fullBandSchema = {
    type: Type.OBJECT,
    properties: {
        detected_bpm: { type: Type.NUMBER, description: "Tempo of this segment in BPM." },
        detected_key: { type: Type.STRING, description: "Musical key, e.g. 'F# Minor'." },
        kick: { type: Type.ARRAY, items: hitSchema },
        snare: { type: Type.ARRAY, items: hitSchema },
        clap: { type: Type.ARRAY, items: hitSchema },
        hihat_closed: { type: Type.ARRAY, items: hitSchema },
        hihat_open: { type: Type.ARRAY, items: hitSchema },
        percussion: { type: Type.ARRAY, items: hitSchema },
        bass: { type: Type.ARRAY, items: preciseNoteSchema },
        sub: { type: Type.ARRAY, items: preciseNoteSchema },
        lead: { type: Type.ARRAY, items: preciseNoteSchema },
        vocal: { type: Type.ARRAY, items: preciseNoteSchema },
        arp: { type: Type.ARRAY, items: preciseNoteSchema },
        chords: { type: Type.ARRAY, items: preciseNoteSchema },
        pad: { type: Type.ARRAY, items: preciseNoteSchema }
    },
    required: ["detected_bpm"]
};

// Which AI stem lands on which engine channel + the fixed pitch used for drum hits
const STEM_MAP: Record<string, { channel: ChannelKey; drumPitch?: string }> = {
    kick:         { channel: 'ch1_kick' as ChannelKey,       drumPitch: 'C1' },
    sub:          { channel: 'ch2_sub' as ChannelKey },
    bass:         { channel: 'ch3_midBass' as ChannelKey },
    lead:         { channel: 'ch4_leadA' as ChannelKey },
    vocal:        { channel: 'ch5_leadB' as ChannelKey },
    arp:          { channel: 'ch6_arpA' as ChannelKey },
    snare:        { channel: 'ch8_snare' as ChannelKey,      drumPitch: 'D1' },
    clap:         { channel: 'ch9_clap' as ChannelKey,       drumPitch: 'D#1' },
    percussion:   { channel: 'ch10_percLoop' as ChannelKey,  drumPitch: 'E1' },
    hihat_closed: { channel: 'ch12_hhClosed' as ChannelKey,  drumPitch: 'F#1' },
    hihat_open:   { channel: 'ch13_hhOpen' as ChannelKey,    drumPitch: 'A#1' },
    pad:          { channel: 'ch15_pad' as ChannelKey },
    chords:       { channel: 'ch16_synth' as ChannelKey }
};

export type TranscriptionMode = 'FULL_BAND' | 'LEAD_ONLY';

const snapTick = (tick: number, grid: number): number => Math.round(tick / grid) * grid;

const parseKey = (detected?: string): { key: string; scale: string } => {
    if (!detected || typeof detected !== 'string') return { key: 'C', scale: 'Minor' };
    const match = detected.trim().match(/^([A-Ga-g][#b]?)\s*(.*)$/);
    if (!match) return { key: 'C', scale: 'Minor' };
    const root = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    const rest = (match[2] || '').toLowerCase();
    let scale = 'Minor';
    if (rest.includes('major')) scale = 'Major';
    else if (rest.includes('phrygian')) scale = 'Phrygian';
    else if (rest.includes('dorian')) scale = 'Dorian';
    else if (rest.includes('lydian')) scale = 'Lydian';
    else if (rest.includes('mixolydian')) scale = 'Mixolydian';
    return { key: root, scale };
};

/**
 * Removes duplicate / stacked transcription artefacts.
 * Drums: one hit per 16th slot. Melodic: no identical pitch retriggered on the same tick.
 */
const dedupeEvents = (events: NoteEvent[], isDrum: boolean): NoteEvent[] => {
    const sorted = [...events].sort((a, b) => (a.startTick || 0) - (b.startTick || 0));
    const seen = new Set<string>();
    const out: NoteEvent[] = [];
    for (const ev of sorted) {
        const tick = ev.startTick || 0;
        const key = isDrum ? `${snapTick(tick, 60)}` : `${tick}-${ev.note}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(ev);
    }
    return out;
};

/**
 * Lightweight energy-based tempo estimate used to lock ALL segments to one grid.
 * Without a shared BPM every 12s chunk was mapped with its own tempo, which made
 * the reconstructed arrangement drift out of time.
 */
export const detectBpmFromBuffer = (buffer: AudioBuffer): number => {
    const data = buffer.getChannelData(0);
    const sr = buffer.sampleRate;
    const windowSize = Math.floor(sr * 0.02);
    const envelope: number[] = [];
    for (let i = 0; i + windowSize < data.length; i += windowSize) {
        let sum = 0;
        for (let j = 0; j < windowSize; j++) sum += Math.abs(data[i + j]);
        envelope.push(sum / windowSize);
    }
    if (envelope.length < 50) return 0;

    // Onset flux
    const flux = envelope.map((v, i) => (i === 0 ? 0 : Math.max(0, v - envelope[i - 1])));
    const envRate = sr / windowSize; // envelope samples per second

    let best = { bpm: 0, score: -1 };
    for (let bpm = 70; bpm <= 200; bpm += 0.5) {
        const lag = Math.round((60 / bpm) * envRate);
        if (lag < 2 || lag >= flux.length) continue;
        let score = 0;
        for (let i = 0; i + lag < flux.length; i++) score += flux[i] * flux[i + lag];
        score /= (flux.length - lag);
        if (score > best.score) best = { bpm, score };
    }
    // Fold into a musical range
    let bpm = best.bpm;
    while (bpm > 190) bpm /= 2;
    while (bpm > 0 && bpm < 85) bpm *= 2;
    return bpm ? Math.round(bpm) : 0;
};

const mapMsToAbsoluteTick = (preciseNote: any, segmentOffsetSec: number, bpm: number): NoteEvent => {


    const totalMs = (segmentOffsetSec * 1000) + (preciseNote.t_ms || 0);
    const PPQ = 480;
    const startTick = Math.round((totalMs * bpm * PPQ) / 60000);
    const durationTicks = Math.round((preciseNote.dur_ms * bpm * PPQ) / 60000);

    const bar = Math.floor(startTick / 1920);
    const beat = Math.floor((startTick % 1920) / 480);
    const sixteenth = Math.floor((startTick % 480) / 120);

    return {
        note: preciseNote.n || 'C4',
        duration: "custom",
        durationTicks: Math.max(1, durationTicks),
        startTick: startTick,
        time: `${bar}:${beat}:${sixteenth}`,
        velocity: Math.max(0.1, Math.min(1.0, preciseNote.v || 0.8)),
        timingOffset: 0,
        pitchBend: preciseNote.pb || 0
    };
};

export const analyzeAudioChunk = async (
    audioBlob: Blob,
    segmentIndex: number,
    chunkDurationSec: number,
    isSilent = false,
    overrideBpm?: number,
    mode: TranscriptionMode = 'FULL_BAND'
): Promise<GrooveObject> => {
  if (isSilent) {
      const groove: any = { id: `SILENT-${segmentIndex}`, bpm: overrideBpm || 140, key: "C", scale: "Minor", totalBars: Math.ceil((chunkDurationSec * (overrideBpm || 140)) / 240) };
      ELITE_16_CHANNELS.forEach(k => groove[k] = []);
      return groove;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = await blobToBase64(audioBlob);
  const segmentOffsetSec = segmentIndex * chunkDurationSec;

  const models = ["gemini-3-pro-preview", "gemini-3-flash-preview"];

  const leadOnlyPrompt = `1:1 MONOPHONIC LEAD EXTRACTION PROTOCOL:
                Analyze Segment #${segmentIndex + 1}.

                CRITICAL DIRECTIVE: The user wants EXACTLY ONE CHANNEL. You must extract ONLY the main lead melody.
                Do NOT transcribe chords. Do NOT transcribe drums, bass, or background pads.
                Find the single most prominent melodic line (the vocal or lead synth) and transcribe it 1-to-1.

                TECHNICAL REQUIREMENTS:
                - MONOPHONIC: Only one note should play at a time. No overlapping notes.
                - PRECISION: Transcribe the EXACT pitch and timing (in ms). Do not hallucinate or simplify.
                - PITCH BENDS: Use the 'pb' field (-8192 to 8191) to capture slides, vibrato, or microtones.
                - VELOCITY: Map the volume/energy of the note to the 'v' field (0.1 to 1.0).

                ${overrideBpm ? `- GRID SYNC: The project BPM is ${overrideBpm}. Align your ms timings to this tempo.` : ''}

                OUTPUT:
                Return the entire extracted melody in the "lead" array. Ignore all other instruments.`;

  const fullBandPrompt = `FULL BAND STEM SEPARATION & TRANSCRIPTION PROTOCOL:
                You are a professional transcription engine. Analyze Segment #${segmentIndex + 1}
                (${chunkDurationSec} seconds of a full mixed song) and SEPARATE it into individual instrument channels.

                MISSION: Do NOT return one merged melody. Listen through the mix and transcribe EACH
                instrument family into its OWN array. A typical track has drums + bass + lead + chords
                playing simultaneously - all of them must be reported separately.

                CHANNELS TO EXTRACT (leave an array empty ONLY if that instrument is genuinely absent):
                - "kick": every low-end transient / bass drum hit (t_ms + velocity only).
                - "snare": snare / rimshot hits.
                - "clap": handclaps and layered claps.
                - "hihat_closed": closed hats & shakers - transcribe the full 8th/16th pattern, not a sample.
                - "hihat_open": open hats / sizzling cymbals.
                - "percussion": toms, congas, rides, fx percussion.
                - "sub": the deepest sine/sub bass line (below C2), pitched.
                - "bass": the main bass line / mid bass (roughly C1-C3), pitched.
                - "lead": the most prominent lead synth/instrument melody.
                - "vocal": the main sung/rapped melodic line if a voice is present (pitched).
                - "arp": fast repetitive arpeggiated 16th patterns.
                - "chords": harmonic stabs/keys - report EACH chord tone as its own note at the same t_ms.
                - "pad": long sustained background harmony notes.

                TECHNICAL REQUIREMENTS:
                - TIMING: t_ms is relative to the START of THIS segment. Be precise to ~10ms.
                - PITCH: scientific notation with octave (e.g. "F#2", "A4"). Bass belongs in low octaves (1-3).
                - POLYPHONY: chords/pad may overlap. lead/bass/sub/vocal should stay monophonic.
                - VELOCITY: map real RMS energy to 'v' (0.1-1.0). Ghost notes get low values.
                - DRUMS: for kick/snare/clap/hats/percussion return only t_ms and v - no pitch needed.
                - DENSITY: a 12 second segment of dance music normally contains 20-50 kick hits,
                  dozens of hats and a continuous bass line. Do not under-report.
                - NO HALLUCINATION: if an instrument is not audible, return an empty array for it.

                ${overrideBpm ? `- GRID SYNC: The project tempo is ${overrideBpm} BPM. Align timings to that grid.` : '- Report the tempo you hear in detected_bpm.'}
                - Report the musical key in "detected_key" (e.g. "F# Minor").`;

  const promptText = mode === 'LEAD_ONLY' ? leadOnlyPrompt : fullBandPrompt;
  const schema = mode === 'LEAD_ONLY' ? rawTranscriptionSchema : fullBandSchema;

  for (const model of models) {
    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
      try {
        const response = await ai.models.generateContent({
            model, 
            contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType: "audio/wav" } },
                    { text: promptText }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.1 
            }
        });

        const raw = JSON.parse(response.text || "{}");
        const bpm = overrideBpm || raw.detected_bpm || 140;
        const keyInfo = parseKey(raw.detected_key);

        const groove: any = { 
            id: `V117-${mode}-${segmentIndex}`, 
            bpm, 
            key: keyInfo.key, 
            scale: keyInfo.scale,
            totalBars: Math.ceil((chunkDurationSec * bpm) / 240),
            meta: { detectedBpm: raw.detected_bpm, mode }
        };

        ELITE_16_CHANNELS.forEach(k => groove[k] = []);

        if (mode === 'LEAD_ONLY') {
            if (raw.lead) groove['ch4_leadA'] = raw.lead.map((n: any) => mapMsToAbsoluteTick(n, segmentOffsetSec, bpm));
            return groove;
        }

        // FULL BAND: fan every stem out to its own engine channel
        Object.entries(STEM_MAP).forEach(([stem, cfg]) => {
            const items = raw[stem];
            if (!Array.isArray(items) || items.length === 0) return;

            const events = items
                .map((n: any) => {
                    if (cfg.drumPitch) {
                        // Drum hits: fixed pitch, short fixed duration, snapped to the 16th grid
                        const ev = mapMsToAbsoluteTick({ n: cfg.drumPitch, t_ms: n.t_ms, dur_ms: 90, v: n.v }, segmentOffsetSec, bpm);
                        ev.startTick = snapTick(ev.startTick || 0, 120);
                        ev.durationTicks = 90;
                        return ev;
                    }
                    return mapMsToAbsoluteTick(n, segmentOffsetSec, bpm);
                })
                .filter((e: NoteEvent) => (e.durationTicks || 0) > 0);

            groove[cfg.channel] = dedupeEvents(events, !!cfg.drumPitch);
        });

        return groove;
      } catch (e: any) {

        const isRateLimit = e.message?.includes('429') || e.status === 'RESOURCE_EXHAUSTED';
        if (isRateLimit) {
            attempts++;
            if (attempts < maxAttempts) {
                console.warn(`[AudioAnalysis] ${model} hit 429, retrying after delay...`);
                await sleep(2000 * attempts);
                continue;
            } else if (model !== models[models.length - 1]) {
                console.warn(`[AudioAnalysis] ${model} exhausted, falling back to next model.`);
                break; // Exit attempts loop to try next model
            }
        }
        console.error(`Chunk ${segmentIndex} Failed with ${model}`, e);
        if (model === models[models.length - 1]) throw e;
        break; // Try next model
      }
    }
  }

  // Fallback if everything failed
  const fallback: any = { id: `FAIL-${segmentIndex}`, bpm: overrideBpm || 140, key: "C", scale: "Chromatic", totalBars: 4 };
  ELITE_16_CHANNELS.forEach(k => fallback[k] = []);
  return fallback;
};

export interface SliceResult {
    chunks: { blob: Blob, isSilent: boolean }[];
    detectedBpm: number;
    durationSec: number;
}

export const sliceAudio = async (file: File, chunkDurationSec: number = 15, onProgress?: (p: number) => void): Promise<SliceResult> => {

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const arrayBuffer = await file.arrayBuffer();
    
    if (onProgress) onProgress(5); // Decoding started
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    if (onProgress) onProgress(15); // Decoding finished

    // Global tempo estimate - all segments will share this grid
    let detectedBpm = 0;
    try { detectedBpm = detectBpmFromBuffer(audioBuffer); } catch (e) { console.warn('[BPM] detection failed', e); }
    const durationSec = audioBuffer.duration;
    
    const targetRate = 22050; 
    const chunks: { blob: Blob, isSilent: boolean }[] = [];
    const sourceRate = audioBuffer.sampleRate;
    const sourceChunkLen = Math.floor(chunkDurationSec * sourceRate);
    const inputL = audioBuffer.getChannelData(0);

    const totalChunks = Math.ceil(audioBuffer.length / sourceChunkLen);
    let processedChunks = 0;

    for (let offset = 0; offset < audioBuffer.length; offset += sourceChunkLen) {
        const end = Math.min(offset + sourceChunkLen, audioBuffer.length);
        const targetLen = Math.floor((end - offset) * (targetRate / sourceRate));
        const chunkBuffer = ctx.createBuffer(1, targetLen, targetRate);
        const outputData = chunkBuffer.getChannelData(0);
        let energy = 0;
        
        for(let i = 0; i < targetLen; i++) {
            const sample = inputL[offset + Math.floor(i * (sourceRate / targetRate))] || 0;
            outputData[i] = sample;
            energy += Math.abs(sample);
        }
        
        chunks.push({ 
            blob: audioBufferToWav(chunkBuffer), 
            isSilent: (energy / targetLen) < 0.0001 
        });

        processedChunks++;
        if (onProgress) {
            // Slicing phase is 15% to 30% of total job progress
            const sliceProgress = 15 + (processedChunks / totalChunks) * 15;
            onProgress(Math.round(sliceProgress));
        }
    }
    
    await ctx.close();
    return { chunks, detectedBpm, durationSec };
};

