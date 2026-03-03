
import type { EngineMeta, StyleEngineProfile, KnowledgeRecord } from './types/learning';

export type { EngineMeta, StyleEngineProfile, KnowledgeRecord };

export type ExportMode = "FULL_TRACK" | "LEAD_ONLY" | "BASS_ONLY" | "DRUMS_ONLY";

// --- DAE-01 Dynamic Arrangement Engine Types ---
export enum SectionType {
  INTRO = 'INTRO',
  MELODY_INTRO = 'MELODY_INTRO',
  BUILDUP = 'BUILDUP',
  DROP = 'DROP',
  BREAKDOWN = 'BREAKDOWN',
  OUTRO = 'OUTRO'
}

export enum EnergyLevel {
  LOW = 1,
  MED = 2,
  HIGH = 3,
  PEAK = 4
}

export interface ArrangementSegment {
  type: SectionType;
  startBar: number;
  durationBars: number;
  energy: EnergyLevel;
  activeInstruments: ChannelKey[];
}

// --- Context Bridge Types ---
export type MusicalGenreContext = 'Trap' | 'Jazz' | 'Techno' | 'Cinematic' | 'LoFi' | 'Psytrance';
export type MoodContext = 'Melancholic' | 'Aggressive' | 'Uplifting' | 'Ethereal' | 'Euphoric' | 'Dark' | 'Hypnotic';
export type InstrumentRole = 'Bass' | 'Lead' | 'Pad' | 'Drums_Kick' | 'Drums_HiHat';

export interface ContextEnvelope {
  genre: MusicalGenreContext;
  subGenre?: string;
  mood: MoodContext;
  role: InstrumentRole;
  bpm: number;
  musicalKey: {
    root: string;
    scale: string;
  };
  suggestedGroove?: {
    swingAmount: number; // 0.0 to 1.0
    humanizeTimingMs: number; // Max deviation in ms
    velocityRange: [number, number];
  };
}

export interface EliteAudioObject {
  id: string;
  timestamp: number;
  rawData: any[]; // The actual MIDI notes
  context: ContextEnvelope;
}

export interface StepNote {
    n: string; 
    s: number; 
    v: number; 
    d: number; 
}

export interface AetherGenome {
    trackName: string;
    patterns: {
        [key: string]: { notes: StepNote[] };
    };
    artist?: string;
    explanation?: string;
    bpm?: number;
    key?: string;
    scale?: string;
    genre?: MusicGenre | string;
}

export interface GenerationParams {
    genre: MusicGenre;
    key: MusicalKey;
    scale: ScaleType;
    bpm: number;
    mode: 'NEW' | 'EVOLVE';
    trackLengthMinutes: number;
    energyMode: EnergyMode;
    bpmMode: BpmMode;
    artistId?: string; // V99 Artist Selection
    creativeNarrative?: string;
}

export enum MusicGenre { 
  PSYTRANCE_FULLON = "Full-On Psytrance", 
  PSYTRANCE_POWER = "Psytrance (Power Groove)",
  GOA_TRANCE = "Goa Trance",
  MELODIC_TECHNO = "Melodic Techno",
  TECHNO_PEAK = "Techno (Peak Time)"
}

export interface StoryMap {
    trackId: string;
    totalBars: number;
    channels: { id: string; segments: number[][] }[];
}

export type ChannelKey = 
  'ch1_kick' | 'ch2_sub' | 'ch3_midBass' | 
  'ch4_leadA' | 'ch5_leadB' | 'ch6_arpA' | 'ch7_arpB' | 
  'ch8_snare' | 'ch9_clap' | 'ch10_percLoop' | 'ch11_percTribal' | 
  'ch12_hhClosed' | 'ch13_hhOpen' | 'ch14_acid' | 'ch15_pad' | 'ch16_synth';

export interface NoteEvent {
  note: string | string[]; 
  duration: string;
  time: string; 
  velocity: number;
  durationTicks?: number; 
  startTick?: number; 
  tickOffset?: number; // V102.5: Micro-timing offset (-15 to +15 ticks)
  timingOffset?: number; 
  offbeat?: boolean;
  pitchBend?: number; // V116: Micro-tonal bend value (-8192 to 8191)
}

export enum MusicalKey {
  C = "C", C_SHARP = "C#", D = "D", D_SHARP = "D#", E = "E", F = "F", 
  F_SHARP = "F#", G = "G", G_SHARP = "G#", A = "A", A_SHARP = "A#", B = "B"
}

export enum ScaleType {
  MINOR = "Minor",
  PHRYGIAN = "Phrygian",
  PHRYGIAN_DOMINANT = "Phrygian Dominant",
  HARMONIC_MINOR = "Harmonic Minor",
  DORIAN = "Dorian",
  MAJOR = "Major",
  LYDIAN = "Lylian"
}

export enum EnergyMode {
  EARLY = "Early Warmup",
  PEAK = "Peak Time",
  LATE = "Late Night"
}

export enum BpmMode {
  AUTO = "AUTO",
  MANUAL = "MANUAL"
}

export interface StudyState {
    isAnalyzing: boolean;
    progress: string;
    progressValue?: number;
    analyzedChunks: GrooveObject[];
}

// --- NEW TYPES ADDED TO FIX COMPILATION ERRORS ---

export type MusicalRole = 'FOUNDATION' | 'RHYTHM' | 'MELODY' | 'FX' | 'ATMOSPHERE';
export type TrackSection = 'INTRO' | 'BUILD' | 'DROP' | 'BREAK' | 'PEAK' | 'OUTRO';
export type ProductionStyle = 'PSYTRANCE_FULL_ON' | 'PSYTRANCE_PROG' | 'TECHNO_PEAK' | 'TECH_HOUSE' | 'DEEP_ORGANIC';

export enum InstrumentType {
    LEAD_SAW = 'LEAD_SAW',
    BASS_ROLL = 'BASS_ROLL',
    PAD_ATMOS = 'PAD_ATMOS'
}

export interface ProducerIssue {
    type: string;
    description: string;
    severity: 'LOW' | 'MED' | 'HIGH';
}

export interface ProducerReport {
    status: 'SUCCESS' | 'FAIL';
    verdict: 'ACCEPT' | 'REJECT';
    issues: ProducerIssue[];
    score: number;
    logs: string[];
}

export interface BarHarmony {
    barIndex: number;
    detectedChord: string;
    conflict: boolean;
}

export interface DetailedAnalysisReport {
    overallScore: number;
    keyConsistency: number;
    harmonicFlow: BarHarmony[];
    trackDetails: any;
    mixingIssues: string[];
    suggestions: string[];
    staticDetection: boolean;
    creativeNarrative: string;
    compositionFeatures: any;
}

export type FxType = 'DISTORTION' | 'DELAY' | 'REVERB' | 'CHORUS' | 'FILTER' | 'BITCRUSHER' | 'EQ3';

export interface FxConfig {
    id: string;
    type: FxType;
    enabled: boolean;
    settings: any;
}

export interface HistorySnapshot {
    id: number;
    label: string;
    payload: GrooveObject;
    timestamp: string;
}

export interface ValidationIssue {
    type: string;
    description: string;
    severity: 'STRONG' | 'PARTIAL';
}

export interface StyleValidationResult {
    status: 'MATCH' | 'MISMATCH' | 'PARTIAL';
    issues: ValidationIssue[];
    targetGenre: MusicGenre;
    suggestedGenre: MusicGenre;
}

export interface ProfileParameters {
    swing: number;
    grooveIntensity: number;
    padPresence: number;
    hookProbability: number;
    midBassWeight: number;
    arpVariation: number;
    breakdownDensity: number;
    peakContrast: number;
}

export interface ProfileVersion {
    versionId: string;
    timestamp: number;
    parameters: ProfileParameters;
    changeLog: string;
    ratingAvg: number;
    generationCount: number;
}

export interface StyleBlueprint {
    name: string;
    scale: number[];
    tempo: { min: number; max: number; default: number };
    density: number;
    repetition: number;
    aggression: number;
    movement: number;
    groove: number;
    motifLength: number;
    legatoAmount: number;
    minNoteDurationTicks: number;
    maxGapAllowedTicks: number;
    structure: { introBars: number; buildBars: number; peakBars: number; outroBars: number };
    feel: { hypnotic: boolean; aggressive: boolean; melodic: boolean };
}

export interface GenerationReportData {
    timestamp: string;
    seedId: string;
    masterSeed: number;
    profile: string;
    profileVersion: string;
    energyMode: string;
    bpmMode: string;
    bpmUsed: number;
    keyScale: string;
    totalBars: number;
    structure: Array<{ name: string; bars: number }>;
    tracks: Array<{ name: string; count: number }>;
    trackCounts: Record<string, number>;
    learningInfo: { applied: boolean; lastChange: string };
    qaStatus: string;
    generationMethod: string;
}

export type FeedbackTag = 'BORING' | 'NO_HOOK' | 'WEAK_DROP' | 'EMPTY_BREAK' | 'TOO_REPETITIVE' | 'GOOD_GROOVE' | 'PERFECT_ENERGY';

export interface UserFeedbackMetrics {
    rating: number;
    manualEdits: number;
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    isGuest: boolean;
}

export interface ProjectRecord {
    id: string;
    userId: string;
    name: string;
    timestamp: number;
    metadata: {
        genre: string;
        bpm: number;
        key: string;
        scale: string;
        energyMode: string;
        profileVersion: string;
    };
    groove: GrooveObject;
    qaScore: number;
    qaStatus: 'PASS' | 'FAIL';
}

export interface ReferenceMidiFile {
    id: string;
    name: string;
    genreTag: string;
    analysisStatus: 'PENDING' | 'ANALYZED' | 'FAILED';
    analysisResult?: StyleEngineProfile;
}

export interface GenreEngineProfile {
    genreTag: string;
    avgLeadDensity: number;
    avgBassDensity: number;
    rhythmMask16: number[];
    pitchRange: { min: number; max: number };
    updatedAt: number;
    sampleCount: number;
}

export interface ReferenceProfileStats {
    filename: string;
    leadScarcity: number;
    avgDensity: number;
    dominantElement: 'LEAD' | 'ACID' | 'ARP';
    phraseLengthBars: number;
    energyProfile: 'PEAKY' | 'DYNAMIC' | 'CONSISTENT';
    timestamp: number;
}

export interface Automation {
    cutoffCurve: number[];
    lufs: number;
}

export interface TrackArrangement {
    kick: NoteEvent[];
    sub: NoteEvent[];
    leadA: NoteEvent[];
    leadB: NoteEvent[];
    arpA: NoteEvent[];
    arpB: NoteEvent[];
    hhOpen: NoteEvent[];
    hhClosed: NoteEvent[];
    snare: NoteEvent[];
    clap: NoteEvent[];
    percussion: NoteEvent[];
    pad: NoteEvent[];
    riser: NoteEvent[];
    impact: NoteEvent[];
    atmos: NoteEvent[];
    crash: NoteEvent[];
}

export interface ArrangementSection {
    name: string;
    startBar: number;
    endBar: number;
    activeTracks?: string[];
    density?: number;
    melodyEnergy?: number;
    intensity?: number;
}

export interface GrooveObject {
  id: string;        
  name: string;      
  bpm: number;
  scale: string;
  key: string;
  genre?: MusicGenre | string; 
  totalBars?: number;
  storyMap?: StoryMap;
  structureMap?: ArrangementSegment[];
  ch1_kick: NoteEvent[]; 
  ch2_sub: NoteEvent[]; 
  ch3_midBass: NoteEvent[]; 
  ch4_leadA: NoteEvent[]; 
  ch5_leadB: NoteEvent[]; 
  ch6_arpA: NoteEvent[]; 
  ch7_arpB: NoteEvent[]; 
  ch8_snare: NoteEvent[]; 
  ch9_clap: NoteEvent[]; 
  ch10_percLoop: NoteEvent[]; 
  ch11_percTribal: NoteEvent[]; 
  ch12_hhClosed: NoteEvent[]; 
  ch13_hhOpen: NoteEvent[]; 
  ch14_acid: NoteEvent[]; 
  ch15_pad: NoteEvent[]; 
  ch16_synth?: NoteEvent[];
  
  // Optional/Legacy fields used across the system
  kick?: NoteEvent[];
  bass?: NoteEvent[];
  leadMain?: NoteEvent[];
  snare?: NoteEvent[];
  hhClosed?: NoteEvent[];
  pad?: NoteEvent[];
  leadAcid?: NoteEvent[];
  arp?: NoteEvent[];
  subBass?: NoteEvent[];
  midBass?: NoteEvent[];
  hhOpen?: NoteEvent[];
  perc1?: NoteEvent[];
  perc2?: NoteEvent[];
  fxRiser?: NoteEvent[];
  fxCrash?: NoteEvent[];
  perc?: NoteEvent[];
  acid?: NoteEvent[];
  fill?: NoteEvent[];
  fx?: NoteEvent[];
  crash?: NoteEvent[];
  glitch?: NoteEvent[];

  analysisMeta?: any;
  masterSeed?: number;
  automation?: Automation;
  mixingGuide?: any;
  structure?: ArrangementSection[];
  meta?: any;
  energyMode?: EnergyMode | string;
  qaReport?: any;
  engineMeta?: EngineMeta;
}
