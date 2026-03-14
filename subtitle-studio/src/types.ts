export interface SubtitleCue {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  translatedText?: string;
  speaker?: string;
}

export type SubtitleAnimationStyle = 'NONE' | 'POP' | 'SLIDE' | 'GLOW';
export type SubtitlePosition = 'TOP' | 'CENTER' | 'BOTTOM';

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  outlineColor: string;
  outlineSize: number;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  shadow: boolean;
  letterSpacing: number;
  maxWidthPercent: number;
  position: SubtitlePosition;
  animation: SubtitleAnimationStyle;
}

export interface SubtitleTranscriptionOptions {
  sourceLanguage: string;
  targetLanguage: string;
  aiProfile: 'SPEED' | 'BALANCED' | 'MAX_QUALITY';
  includeSpeakerLabels: boolean;
  maxCharsPerLine: number;
  preserveFillerWords: boolean;
}

export interface SubtitleQualityIssue {
  cueId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
}

export interface SubtitleQualityReport {
  score: number;
  issues: SubtitleQualityIssue[];
}

export interface SubtitleProjectSnapshot {
  sourceLanguage: string;
  targetLanguage: string;
  customTargetLanguage: string;
  detectedLanguage: string;
  style: SubtitleStyle;
  displayMode: 'TRANSLATED' | 'ORIGINAL' | 'BILINGUAL';
  cues: SubtitleCue[];
  aiProfile: 'SPEED' | 'BALANCED' | 'MAX_QUALITY';
  includeSpeakerLabels: boolean;
  maxCharsPerLine: number;
  preserveFillerWords: boolean;
}
