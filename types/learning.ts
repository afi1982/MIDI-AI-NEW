

export type GenreId =
  | "PSYTRANCE_FULLON"
  | "PSYTRANCE_PROG"
  | "TECHNO_PEAK"
  | "TECHNO_RAW"
  | "UNKNOWN";

export type RoleHint =
  | "KICK" | "SNARE" | "CLAP" | "HHC" | "HHO"
  | "BASS" | "MIDBASS"
  | "LEAD" | "ACID" | "ARP" | "PAD" | "FX"
  | "UNKNOWN";

export type LibraryTag =
  | "KICK_PATTERN"
  | "ROLLING_BASS"
  | "OFFBEAT_BASS"
  | "ACID_LEAD"
  | "MELODIC_LEAD"
  | "GROOVE_HATS"
  | "ARRANGEMENT"
  | "FILL_TRANSITIONS";

export interface TrackStat {
  roleHint: RoleHint;
  noteDensity: number;       // notes per bar
  pitchMin: number;
  pitchMax: number;
  avgVelocity: number;       // 0..1
  repetitionScore: number;   // 0..1
  // Added for compatibility with analysis services
  trackName?: string;
  rhythmMask16?: number[];
}

export interface DrumSignature {
  fourOnFloorScore: number;     // 0..1
  hat16thScore: number;         // 0..1
  snareBackbeatScore: number;   // 0..1
  fillRate: number;             // per 16 bars
}

export interface BassSignature {
  rolling16thScore: number;   // 0..1
  offbeatScore: number;       // 0..1
  sustainScore: number;       // 0..1
  gapScore: number;           // 0..1 (higher = more holes)
}

export interface ArrangementSignature {
  introBarsGuess: number;
  buildBarsGuess: number;
  dropBarsGuess: number;
  breakdownBarsGuess?: number;
  outroBarsGuess?: number;
  energyCurve: number[];      // normalized windows
}

export interface StyleEngineProfile {
  bpmEstimate: number;
  bpmConfidence: number;        // 0..1
  noteDensityAvg: number;
  velocityAvg: number;          // 0..1
  syncopationScore: number;     // 0..1
  swingEstimate?: number;       // 0..1
  pitchRange: { min: number; max: number };
  drumSignature?: DrumSignature;
  bassSignature?: BassSignature;
  arrangementSignature?: ArrangementSignature;
  trackStats: TrackStat[];
  // Added for profile service compatibility
  detectedGenre?: string;
}

export interface PatternExtract {
  role: RoleHint;
  bars: number;
  steps16: Array<{ step: number; pitch?: number; vel?: number; gate?: number }>;
}

export interface KnowledgeRecord {
  id: string;
  createdAtISO: string;
  sourceFileName?: string;       // optional (can be blank after deletion)
  genre: GenreId;
  confidence?: number;
  tags?: LibraryTag[];
  profile: StyleEngineProfile;
  patterns?: PatternExtract[];    // optional compact patterns (not full MIDI)
  
  // V28 Engine Scoring
  engineScore: number; // 0-100
  qualityTags: string[]; // e.g. "HIGH_DENSITY", "CLEAN_RHYTHM", "SHORT_SAMPLE"
  contributionTags: string[]; // e.g. "DRUMS", "BASS", "LEAD"
}

export interface InspirationQuery {
  genre: GenreId;
  selectedRoles: RoleHint[];
  targetBpm: number;
  maxItems: number;              // e.g., 5
}

export interface InspirationBundle {
  genre: GenreId;
  recordIds: string[];
  confidence: number;            // 0..1
  influence: {
    grooveIntensityDelta?: number;  // -0.1..+0.1
    hatDensityDelta?: number;       // -0.1..+0.1
    bassRollingBias?: number;       // 0..1
    fillRateDelta?: number;         // -0.1..+0.1
    arrangementHints?: Partial<ArrangementSignature>;
  };
  seedPatterns?: PatternExtract[];
}

export interface EngineMeta {
  usedLibrary: boolean;
  recordIds?: string[];
  influenceApplied?: InspirationBundle["influence"];
  influenceWeight: number;        // 0.05..0.1
  // Added missing forensic and arrangement properties
  arrangementApplied?: boolean;
  plan?: any;
  usedSourcesCount?: number;
  fingerprints?: any;
  EarliestTickGlobal?: number;
  EarliestTickPerTrack?: any;
  EngineEnabled?: boolean;
  AppliedSourcesCount?: number;
  MelodyEngine?: string;
  MelodyStyle?: string;
  MelodyTarget?: string;
  MelodyPeakBar?: number;
  MelodyPhraseBars?: number;
  MelodyMotifLen?: number;
}
