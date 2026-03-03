
import { 
  MusicGenre, MusicalRole, TrackSection, ProductionStyle, 
  InstrumentType, MusicalKey, ScaleType 
} from '../types';

interface Preset {
  genre: MusicGenre;
  style: ProductionStyle;
  role: MusicalRole;
  section: TrackSection;
  instrument: InstrumentType;
  key: MusicalKey;
  scale: ScaleType;
  complexity: 'Simple' | 'Medium' | 'Complex';
  bars: 1 | 2 | 4 | 8;
  bpm: number;
}

// Helper to get random item from an enum or array
function getRandomItem<T>(collection: any): T {
  const values = Array.isArray(collection) ? collection : Object.values(collection);
  return values[Math.floor(Math.random() * values.length)] as T;
}

// --- FIX: Defined arrays for types that are not enums ---
const PRODUCTION_STYLES: ProductionStyle[] = ['PSYTRANCE_FULL_ON', 'PSYTRANCE_PROG', 'TECHNO_PEAK', 'TECH_HOUSE', 'DEEP_ORGANIC'];
const MUSICAL_ROLES: MusicalRole[] = ['FOUNDATION', 'RHYTHM', 'MELODY', 'FX', 'ATMOSPHERE'];
const TRACK_SECTIONS: TrackSection[] = ['INTRO', 'BUILD', 'DROP', 'BREAK', 'PEAK', 'OUTRO'];

export const generateSmartPreset = (): Preset => {
  // 1. Pick a base Genre
  const genre = getRandomItem<MusicGenre>(MusicGenre);
  
  // 2. Determine BPM based on Genre
  let bpm = 138;
  if (genre.includes("Psytrance")) bpm = Math.floor(Math.random() * (148 - 140) + 140); // Faster for Psy
  else if (genre.includes("Techno")) bpm = Math.floor(Math.random() * (135 - 128) + 128);
  else if (genre.includes("Ambient")) bpm = Math.floor(Math.random() * (110 - 80) + 80);
  else if (genre.includes("House")) bpm = Math.floor(Math.random() * (128 - 120) + 120);

  // 3. Pick a Style that fits or contrasts
  // --- FIX: Use PRODUCTION_STYLES array instead of type name ---
  let style = getRandomItem<ProductionStyle>(PRODUCTION_STYLES);
  
  // 4. Pick a Role (mostly primarily visual for the preset object)
  // --- FIX: Use MUSICAL_ROLES array instead of type name ---
  const role = getRandomItem<MusicalRole>(MUSICAL_ROLES);
  
  // 5. Pick appropriate Instrument
  let instrument = InstrumentType.LEAD_SAW;
  
  // 6. Enhanced Key/Scale selection - TARGETING "EMOTIONAL TRANCE"
  const keys = Object.values(MusicalKey);
  const key = keys[Math.floor(Math.random() * keys.length)] as MusicalKey;
  
  let scale = ScaleType.MINOR;
  
  // Logic for "Touching/Emotional" Trance
  if (genre.includes("Psytrance") || genre.includes("Full-On")) {
    // 60% Phrygian (Psychedelic), 30% Harmonic Minor (Dramatic/Emotional), 10% Minor
    const rand = Math.random();
    if (rand > 0.4) scale = ScaleType.PHRYGIAN;
    else if (rand > 0.1) scale = ScaleType.HARMONIC_MINOR;
    else scale = ScaleType.MINOR;
  } else if (genre.includes("Progressive")) {
    // Progressive: Needs to be deep. Minor and Dorian work best.
    const rand = Math.random();
    if (rand > 0.5) scale = ScaleType.MINOR;
    else scale = ScaleType.DORIAN;
  } else {
      // General fallbacks
      scale = ScaleType.MINOR;
  }

  // 7. Enhanced Complexity & Structure
  // --- FIX: Use TRACK_SECTIONS array instead of type name ---
  const section = getRandomItem<TrackSection>(TRACK_SECTIONS);
  
  // Force higher complexity for professional results
  const complexity = 'Complex'; 
  
  // Force 8 bars for evolution
  const bars = 8;

  return {
    genre,
    style,
    role,
    section,
    instrument,
    key,
    scale,
    complexity,
    bars,
    bpm
  };
};
