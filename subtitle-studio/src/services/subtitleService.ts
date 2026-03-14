import { GoogleGenAI, Type } from '@google/genai';
import type { SubtitleCue, SubtitleTranscriptionOptions } from '../types';

const MODELS = ['gemini-3-pro-preview', 'gemini-3-flash-preview'];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const transcriptionSchema = {
  type: Type.OBJECT,
  properties: {
    detectedLanguage: { type: Type.STRING },
    targetLanguage: { type: Type.STRING },
    summary: { type: Type.STRING },
    cues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          startSec: { type: Type.NUMBER },
          endSec: { type: Type.NUMBER },
          text: { type: Type.STRING },
          translatedText: { type: Type.STRING },
          speaker: { type: Type.STRING }
        },
        required: ['startSec', 'endSec', 'text', 'translatedText']
      }
    }
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

export interface SubtitleTranscriptionResult {
  detectedLanguage: string;
  targetLanguage: string;
  summary?: string;
  cues: SubtitleCue[];
}

const fileToBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.split(',')[1] : value);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const toSafeCue = (cue: Partial<SubtitleCue>, index: number): SubtitleCue => {
  const startSec = Number.isFinite(cue.startSec) ? Math.max(0, Number(cue.startSec)) : index * 2;
  const endSec = Number.isFinite(cue.endSec) ? Math.max(startSec + 0.2, Number(cue.endSec)) : startSec + 2;
  return {
    id: cue.id || `cue-${Date.now()}-${index}`,
    startSec,
    endSec,
    text: (cue.text || '').trim(),
    translatedText: (cue.translatedText || cue.text || '').trim(),
    speaker: cue.speaker?.trim() || undefined
  };
};

export const normalizeSubtitleCues = (cues: Partial<SubtitleCue>[]): SubtitleCue[] =>
  cues
    .map((cue, index) => toSafeCue(cue, index))
    .filter(cue => cue.text.length > 0)
    .sort((a, b) => a.startSec - b.startSec);

export const transcribeAndTranslateMedia = async (
  file: File,
  options: SubtitleTranscriptionOptions,
  onProgress?: (progress: number) => void
): Promise<SubtitleTranscriptionResult> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  const sourceLanguage = options.sourceLanguage || 'Auto detect';
  const targetLanguage = options.targetLanguage || 'English';
  const base64Data = await fileToBase64(file);

  onProgress?.(10);

  const prompt = `You are a professional subtitle engine for short-form social media.
Transcribe the speech and create subtitle cues with accurate startSec/endSec.
Then translate each cue to ${targetLanguage}.

Rules:
- Source language hint: ${sourceLanguage}
- Preserve tone, slang, punctuation, and emojis
- Keep cues readable (1-2 lines when possible)
- Return JSON only
- If there is no speech, return one cue with "[No speech]"
`;

  let lastError: Error | null = null;

  for (const model of MODELS) {
    try {
      onProgress?.(40);
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

      onProgress?.(90);
      const raw = JSON.parse(response.text || '{}');
      const cues = normalizeSubtitleCues((raw.cues || []).map((cue: any, index: number) => ({
        id: `cue-${index}-${Date.now()}`,
        startSec: cue.startSec,
        endSec: cue.endSec,
        text: cue.text,
        translatedText: cue.translatedText,
        speaker: cue.speaker
      })));

      if (cues.length === 0) throw new Error('No cues returned.');

      onProgress?.(100);
      return {
        detectedLanguage: raw.detectedLanguage || sourceLanguage,
        targetLanguage: raw.targetLanguage || targetLanguage,
        summary: raw.summary || '',
        cues
      };
    } catch (error: any) {
      lastError = error;
      const isRateLimited = error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED';
      if (isRateLimited) await sleep(1200);
    }
  }

  throw lastError || new Error('Transcription failed.');
};

export const translateSubtitleCues = async (
  cues: SubtitleCue[],
  targetLanguage: string,
  sourceLanguage = 'Auto detect'
): Promise<SubtitleCue[]> => {
  if (cues.length === 0) return cues;
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  const input = cues.map(cue => ({ id: cue.id, text: cue.text }));
  const prompt = `Translate these subtitle cues into ${targetLanguage}.
Source language hint: ${sourceLanguage}.
Return JSON only with shape { cues: [{ id, translatedText }] }.

Input:
${JSON.stringify(input)}
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
      const isRateLimited = error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED';
      if (isRateLimited) await sleep(1000);
    }
  }

  return cues.map(cue => ({ ...cue, translatedText: cue.translatedText || cue.text }));
};

const formatSrtTime = (seconds: number): string => {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};

const formatVttTime = (seconds: number): string => {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};

export const subtitlesToSrt = (cues: SubtitleCue[], useTranslatedText = true): string =>
  normalizeSubtitleCues(cues).map((cue, index) => {
    const text = useTranslatedText ? (cue.translatedText || cue.text) : cue.text;
    return `${index + 1}\n${formatSrtTime(cue.startSec)} --> ${formatSrtTime(cue.endSec)}\n${text}`;
  }).join('\n\n');

export const subtitlesToVtt = (cues: SubtitleCue[], useTranslatedText = true): string =>
  `WEBVTT\n\n${normalizeSubtitleCues(cues).map((cue) => {
    const text = useTranslatedText ? (cue.translatedText || cue.text) : cue.text;
    return `${formatVttTime(cue.startSec)} --> ${formatVttTime(cue.endSec)}\n${text}`;
  }).join('\n\n')}`;

export const downloadTextFile = (content: string, fileName: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
