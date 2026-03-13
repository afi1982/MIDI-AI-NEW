import { GoogleGenAI, Type } from '@google/genai';
import type { SubtitleCue, SubtitleTranscriptionOptions } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const MODELS = ['gemini-3-pro-preview', 'gemini-3-flash-preview'];

const subtitleCueSchema = {
  type: Type.OBJECT,
  properties: {
    startSec: { type: Type.NUMBER },
    endSec: { type: Type.NUMBER },
    text: { type: Type.STRING },
    translatedText: { type: Type.STRING },
    speaker: { type: Type.STRING }
  },
  required: ['startSec', 'endSec', 'text', 'translatedText']
};

const transcriptionSchema = {
  type: Type.OBJECT,
  properties: {
    detectedLanguage: { type: Type.STRING },
    targetLanguage: { type: Type.STRING },
    summary: { type: Type.STRING },
    cues: { type: Type.ARRAY, items: subtitleCueSchema }
  },
  required: ['detectedLanguage', 'targetLanguage', 'cues']
};

const translationSchema = {
  type: Type.OBJECT,
  properties: {
    cues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          translatedText: { type: Type.STRING }
        },
        required: ['id', 'translatedText']
      }
    }
  },
  required: ['cues']
};

const fileToBase64 = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const toSafeCue = (rawCue: Partial<SubtitleCue>, index: number): SubtitleCue => {
  const startSec = Number.isFinite(rawCue.startSec) ? Math.max(0, Number(rawCue.startSec)) : index * 2;
  const endSecRaw = Number.isFinite(rawCue.endSec) ? Number(rawCue.endSec) : startSec + 2;
  const endSec = Math.max(startSec + 0.2, endSecRaw);
  return {
    id: rawCue.id || `cue-${Date.now()}-${index}`,
    startSec,
    endSec,
    text: (rawCue.text || '').trim(),
    translatedText: (rawCue.translatedText || rawCue.text || '').trim(),
    speaker: rawCue.speaker?.trim() || undefined
  };
};

export const normalizeSubtitleCues = (cues: Partial<SubtitleCue>[]): SubtitleCue[] => {
  return cues
    .map((cue, index) => toSafeCue(cue, index))
    .filter(cue => cue.text.length > 0)
    .sort((a, b) => a.startSec - b.startSec)
    .map((cue, index) => ({
      ...cue,
      id: cue.id || `cue-${index}-${Math.floor(cue.startSec * 1000)}`
    }));
};

export interface SubtitleTranscriptionResult {
  detectedLanguage: string;
  targetLanguage: string;
  summary?: string;
  cues: SubtitleCue[];
}

export const transcribeAndTranslateMedia = async (
  file: File,
  options: SubtitleTranscriptionOptions,
  onProgress?: (progress: number) => void
): Promise<SubtitleTranscriptionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const targetLanguage = options.targetLanguage?.trim() || 'English';
  const sourceLanguage = options.sourceLanguage?.trim() || 'Auto detect';
  let lastError: Error | null = null;

  onProgress?.(5);
  const base64Data = await fileToBase64(file);
  onProgress?.(25);

  const prompt = `You are an expert subtitle engine for social short-form videos.
Transcribe and subtitle this media file with precise timings.

Requirements:
- Source language hint: ${sourceLanguage}
- Translate subtitles into: ${targetLanguage}
- Keep each subtitle cue readable (typically 1-2 lines).
- Cue duration should generally be 1.0 to 6.0 seconds.
- Preserve names, slang, emojis, and punctuation naturally.
- If no speech is present, return a short cue that states "[No speech]".
- Always return translatedText, even if translation equals original text.
- Return timings in seconds from media start.
- Do not include markdown. Return JSON only.
`;

  for (const model of MODELS) {
    try {
      onProgress?.(45);
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: file.type || 'application/octet-stream'
              }
            },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: transcriptionSchema,
          temperature: 0.2
        }
      });

      onProgress?.(85);
      const raw = JSON.parse(response.text || '{}');
      const cues = normalizeSubtitleCues((raw.cues || []).map((cue: any, index: number) => ({
        id: `cue-${index}-${Date.now()}`,
        startSec: cue.startSec,
        endSec: cue.endSec,
        text: cue.text,
        translatedText: cue.translatedText,
        speaker: cue.speaker
      })));

      if (cues.length === 0) throw new Error('No subtitles returned by model.');

      onProgress?.(100);
      return {
        detectedLanguage: raw.detectedLanguage || sourceLanguage,
        targetLanguage: raw.targetLanguage || targetLanguage,
        summary: raw.summary || '',
        cues
      };
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED';
      if (isRateLimit) await sleep(1200);
    }
  }

  throw lastError || new Error('Subtitle transcription failed.');
};

export const translateSubtitleCues = async (
  cues: SubtitleCue[],
  targetLanguage: string,
  sourceLanguage = 'Auto detect'
): Promise<SubtitleCue[]> => {
  if (cues.length === 0) return [];

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const compactCues = cues.map(cue => ({ id: cue.id, text: cue.text }));
  const prompt = `Translate every subtitle text to ${targetLanguage}.
Source language hint: ${sourceLanguage}
Rules:
- Keep emotional tone and slang.
- Keep line breaks where possible.
- Do not censor text.
- Return JSON only with { cues: [{ id, translatedText }] }.

Input:
${JSON.stringify(compactCues)}
`;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: translationSchema,
          temperature: 0.2
        }
      });

      const raw = JSON.parse(response.text || '{}');
      const translatedMap = new Map<string, string>(
        (raw.cues || []).map((item: any) => [String(item.id), String(item.translatedText || '')])
      );

      return cues.map(cue => ({
        ...cue,
        translatedText: translatedMap.get(cue.id) || cue.translatedText || cue.text
      }));
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED';
      if (isRateLimit) await sleep(1000);
    }
  }

  return cues.map(cue => ({ ...cue, translatedText: cue.translatedText || cue.text }));
};

const formatSrtTimestamp = (seconds: number): string => {
  const safeSeconds = clamp(seconds, 0, 86399.999);
  const totalMs = Math.round(safeSeconds * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};

const formatVttTimestamp = (seconds: number): string => {
  const safeSeconds = clamp(seconds, 0, 86399.999);
  const totalMs = Math.round(safeSeconds * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};

export const subtitlesToSrt = (cues: SubtitleCue[], useTranslatedText = true): string => {
  const safeCues = normalizeSubtitleCues(cues);
  return safeCues
    .map((cue, index) => {
      const text = useTranslatedText ? (cue.translatedText || cue.text) : cue.text;
      return `${index + 1}\n${formatSrtTimestamp(cue.startSec)} --> ${formatSrtTimestamp(cue.endSec)}\n${text.trim()}`;
    })
    .join('\n\n');
};

export const subtitlesToVtt = (cues: SubtitleCue[], useTranslatedText = true): string => {
  const safeCues = normalizeSubtitleCues(cues);
  const rows = safeCues
    .map(cue => {
      const text = useTranslatedText ? (cue.translatedText || cue.text) : cue.text;
      return `${formatVttTimestamp(cue.startSec)} --> ${formatVttTimestamp(cue.endSec)}\n${text.trim()}`;
    })
    .join('\n\n');
  return `WEBVTT\n\n${rows}`;
};

export const downloadSubtitleFile = (content: string, fileName: string, mimeType = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
