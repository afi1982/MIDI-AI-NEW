import { GoogleGenAI, Type } from "@google/genai";
import { GrooveObject, NoteEvent } from '../types';

const noteEventSchema = {
  type: Type.OBJECT,
  properties: {
    note: { type: Type.STRING },
    duration: { type: Type.STRING },
    time: { type: Type.STRING },
    velocity: { type: Type.NUMBER },
    timingOffset: { type: Type.NUMBER }
  },
  required: ["note", "duration", "time", "velocity"]
};

// V16.8 Ultra Schema - Forensic Analysis
const fullTrackSchema: any = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    bpm: { type: Type.NUMBER },
    scale: { type: Type.STRING },
    key: { type: Type.STRING },
    
    // Rhythm Section
    kick: { type: Type.ARRAY, items: noteEventSchema },
    bass: { type: Type.ARRAY, items: noteEventSchema },
    snare: { type: Type.ARRAY, items: noteEventSchema },
    hihatOpen: { type: Type.ARRAY, items: noteEventSchema },
    hihatClosed: { type: Type.ARRAY, items: noteEventSchema },
    percLoop: { type: Type.ARRAY, items: noteEventSchema }, 
    
    // Melodic
    leadMain: { type: Type.ARRAY, items: noteEventSchema },
    acidLine: { type: Type.ARRAY, items: noteEventSchema },
    arpLayer: { type: Type.ARRAY, items: noteEventSchema },
    padAtmosphere: { type: Type.ARRAY, items: noteEventSchema },
    
    // Metadata
    automation: {
      type: Type.OBJECT,
      properties: {
        cutoffCurve: { type: Type.ARRAY, items: { type: Type.NUMBER } }, 
        lufs: { type: Type.NUMBER }
      }
    },
    mixingGuide: {
      type: Type.OBJECT,
      properties: {
        eq: { type: Type.STRING },
        compression: { type: Type.STRING },
        sidechain: { type: Type.STRING },
        soundDesign: { type: Type.STRING }
      }
    }
  }
};

const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    // Simple WAV encoder
    const numOfChan = 1; // Force Mono
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channel = buffer.getChannelData(0);
    let sample, offset = 0;
    
    const writeString = (s: string) => {
        for (let i = 0; i < s.length; i++) {
            out.setUint8(offset + i, s.charCodeAt(i));
        }
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeAudioChunk = async (audioBlob: Blob, segmentIndex: number): Promise<GrooveObject> => {
  // Fix: Using process.env.API_KEY directly as required
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Fix: Using gemini-3-pro-preview for complex forensic analysis of audio segments
  const model = "gemini-3-pro-preview"; 

  try {
    const base64Data = await blobToBase64(audioBlob);
    
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            // --- FIX: Simplified contents structure to parts array as per SDK guidelines ---
            const response = await ai.models.generateContent({
              model: model,
              contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType: "audio/wav" } },
                    { text: `Analyze Segment #${segmentIndex + 1}.` }
                ]
              },
              config: {
                responseMimeType: "application/json",
                responseSchema: fullTrackSchema, 
                temperature: 0.1,
                // Avoid setting maxOutputTokens without thinkingBudget as per guidelines
              }
            });

            let text = response.text;
            if (!text) throw new Error("No data returned from Gemini");
            text = text.replace(/```json\n?|```/g, "").trim();
            const result = JSON.parse(text) as GrooveObject;
            result.id = `CHUNK-${segmentIndex}-${Date.now()}`;
            return result;

        } catch (e: any) {
            console.warn(`Chunk ${segmentIndex} Attempt ${attempt} Failed:`, e);
            lastError = e;
            await sleep(2000 * Math.pow(2, attempt));
        }
    }
    throw lastError;

  } catch (error: any) {
    console.error(`Chunk ${segmentIndex} Analysis Failed:`, error);
    throw error;
  }
};

export const sliceAudio = async (file: File, chunkDurationSec: number = 5): Promise<Blob[]> => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        
        // --- DOWNSAMPLING TO 22050Hz MONO ---
        // This reduces payload size by ~75% vs 44.1kHz Stereo, fixing RPC errors.
        const targetRate = 22050; 
        const chunks: Blob[] = [];
        
        const sourceRate = audioBuffer.sampleRate;
        const sourceChunkLen = Math.floor(chunkDurationSec * sourceRate);
        const totalSourceSamples = audioBuffer.length;
        
        const inputL = audioBuffer.getChannelData(0);
        // Mix to mono if stereo
        const inputR = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;

        for (let offset = 0; offset < totalSourceSamples; offset += sourceChunkLen) {
            const end = Math.min(offset + sourceChunkLen, totalSourceSamples);
            const sourceSliceLen = end - offset;
            
            const targetLen = Math.floor(sourceSliceLen * (targetRate / sourceRate));
            const chunkBuffer = ctx.createBuffer(1, targetLen, targetRate);
            const outputData = chunkBuffer.getChannelData(0);

            const step = sourceRate / targetRate;
            
            for (let i = 0; i < targetLen; i++) {
                const sourceIdx = Math.floor(i * step); 
                const realIdx = offset + sourceIdx;
                
                if (realIdx < end) {
                    let sample = inputL[realIdx];
                    if (inputR) sample = (sample + inputR[realIdx]) * 0.5;
                    outputData[i] = sample;
                }
            }
            chunks.push(audioBufferToWav(chunkBuffer));
        }
        return chunks;
    } catch (e) {
        console.error("Audio Slicing Error:", e);
        throw new Error("Failed to decode audio file.");
    } finally {
        if (ctx && ctx.state !== 'closed') {
            await ctx.close();
        }
    }
};