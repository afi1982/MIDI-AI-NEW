
import { MusicGenre } from '../types';

export interface ArtistProfile {
    id: string;
    name: string;
    description: string;
    melodicTraits: string;
}

export const ARTIST_MATRIX: Record<string, ArtistProfile[]> = {
    [MusicGenre.PSYTRANCE_FULLON]: [
        { id: 'astrix', name: 'Astrix', description: 'Precision, clarity, and hypnotic driving leads.', melodicTraits: 'Use clean intervals, Phrygian scales, and 1/16th rhythmic precision.' },
        { id: 'vini_vici', name: 'Vini Vici', description: 'Tribal energy and chanting melodic structures.', melodicTraits: 'Focus on repetitive triplets, ethnic-inspired melodic jumps, and high energy.' },
        { id: 'tristan', name: 'Tristan', description: 'High-energy, psychedelic forest-edge full-on.', melodicTraits: 'Constant movement, fast-changing octave jumps, and FM-modulated lead textures.' }
    ],
    [MusicGenre.PSYTRANCE_POWER]: [
        { id: 'ace_ventura', name: 'Ace Ventura', description: 'Deep, groovy, and sophisticated arrangements.', melodicTraits: 'Minimalist but powerful motifs, subtle filter movements, and wide stereo arps.' },
        { id: 'liquid_soul', name: 'Liquid Soul', description: 'Dreamy, progressive, and melodic atmospheres.', melodicTraits: 'Long sustained emotional notes, Dorian scale influence, and soaring pads.' },
        { id: 'neelix', name: 'Neelix', description: 'Dynamic, bouncy, and cut-through arrangements.', melodicTraits: 'Stuttering lead gates, unexpected rhythmic pauses, and playful melodic lines.' }
    ],
    [MusicGenre.GOA_TRANCE]: [
        { id: 'infected_mushroom', name: 'Infected Mushroom', description: 'Classical complexity and glitchy guitar-style leads.', melodicTraits: 'Extreme melodic complexity, baroque-style counterpoint, and rapid pitch bends.' },
        { id: 'skazi', name: 'Skazi', description: 'Aggressive, rock-influenced synth riffs.', melodicTraits: 'High velocity accents, power-chord structures, and distorted lead sequences.' },
        { id: 'astral_projection', name: 'Astral Projection', description: 'Euphoric, multilayered old-school Goa.', melodicTraits: 'Triad-based melodies, rich harmonic layers, and sweeping melodic anthem style.' }
    ],
    [MusicGenre.MELODIC_TECHNO]: [
        { id: 'anyma', name: 'Anyma', description: 'Futuristic, visual, and emotional storytelling.', melodicTraits: 'Industrial-emotional melodies, single-note focus with filter automation, and dark tension.' },
        { id: 'tale_of_us', name: 'Tale of Us', description: 'Deep, atmospheric, and cinematic techno.', melodicTraits: 'Sustained minor chords, minimalist piano-like leads, and vast reverb spaces.' },
        { id: 'artbat', name: 'Artbat', description: 'Powerful, peak-time melodic anthems.', melodicTraits: 'Driving melodic hooks, repetitive strong intervals, and high-impact synth stabs.' }
    ],
    [MusicGenre.TECHNO_PEAK]: [
        { id: 'charlotte_de_witte', name: 'Charlotte de Witte', description: 'Dark, acid-focused, and uncompromising techno.', melodicTraits: 'Repetitive 303 acid lines, narrow pitch range, and hypnotic industrial loops.' },
        { id: 'adam_beyer', name: 'Adam Beyer', description: 'Precise, powerful, and heavy peak-time sound.', melodicTraits: 'Percussive synth stabs, focused mid-range motifs, and aggressive syncopation.' },
        { id: 'enrico_sangiuliano', name: 'Enrico Sangiuliano', description: 'Conceptual, cosmic, and evolving techno.', melodicTraits: 'Evolving melodic loops, wide spectral movements, and space-themed melodic arcs.' }
    ]
};
