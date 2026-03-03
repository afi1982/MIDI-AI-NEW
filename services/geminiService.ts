
import { GoogleGenAI } from "@google/genai";
import { GenerationParams, AetherGenome, ChannelKey } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateTranceSequence = async (params: GenerationParams, channels?: ChannelKey[]): Promise<AetherGenome> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const channelList = channels ? channels.join(', ') : 'All Channels';
    
    const prompt = `
    Act as a Professional Psytrance Music Producer.
    Generate a full track genome for:
    Genre: ${params.genre}
    BPM: ${params.bpm}
    Key: ${params.key} ${params.scale}
    Target Channels: ${channelList}
    
    BASSLINE SPECIFICATION (Strictly for ch2_sub and ch3_midBass):
    - Use a 1/16th Grid (120 Ticks).
    - Prioritize slots 2, 3, and 4 of each beat (K-B-B-B pattern).
    - Implement Octave Call and Response: foundation on C1, movement on C2.
    - Note Gate: 60-84 Ticks (50-70% of slot).
    - Sidechain: Never place bass on slot 0 (Kick position).
    
    Output valid JSON matching this structure:
    {
      "trackName": "Generated Track",
      "patterns": {
        "ch1_kick": { "notes": [{"n":"C1","s":0,"v":1,"d":120}, ...] },
        "ch2_sub": { "notes": [{"n":"F#1","s":1,"v":0.9,"d":70}, {"n":"F#1","s":2,"v":0.9,"d":70}, ...] }
      }
    }
    Use 's' for 16th step index (0-15).
    Ensure patterns are genre-appropriate.
    `;

    const models = ["gemini-3-pro-preview", "gemini-3-flash-preview"];
    
    for (const model of models) {
        try {
            const response = await ai.models.generateContent({
                model: model,
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: "application/json" }
            });
            
            const result = JSON.parse(response.text || '{}');
            return result;
        } catch (e: any) {
            const isRateLimit = e.message?.includes('429') || e.status === 'RESOURCE_EXHAUSTED';
            if (isRateLimit && model !== models[models.length - 1]) {
                console.warn(`[GeminiService] ${model} exhausted, falling back to next model...`);
                await sleep(1000);
                continue;
            }
            console.error(`AI Generation Failed with ${model}`, e);
        }
    }
    return { trackName: "Fallback", patterns: {} };
};

export const deconstructYoutubeLink = async (url: string): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Analyze this YouTube URL context: ${url}. Return JSON with artist, trackName, bpm, key, scale, explanation. Estimate if unknown.`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { artist: "Unknown", trackName: "Link Analysis Failed", bpm: 145 };
    }
};

export const analyzeSystemVideo = async (file: File) => {
    return { status: "MOCK_ANALYSIS", message: "Video analysis requires Vision model integration." };
};

export const analyzeMidiExpert = async (file: File) => {
    return { status: "MOCK_ANALYSIS", message: "MIDI expert analysis placeholder." };
};

export const generateDivineMelody = async (params: any) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Generate a melody for ${JSON.stringify(params)}. Return JSON array of notes [{"n":"C4","s":0,"d":120,"v":0.8},...].`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '[]');
    } catch { return []; }
};

export const geminiService = {
    analyzeStyleAndGenerate: async (artistName: string, params: GenerationParams) => {
        return generateTranceSequence(params);
    }
};
