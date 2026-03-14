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
}
