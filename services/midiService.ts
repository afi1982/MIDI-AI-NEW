
import { Midi } from '@tonejs/midi';
import { loadMidiFile } from './midiFileService';
import { GrooveObject, NoteEvent, ChannelKey, ScaleType } from '../types.ts';
import MidiWriter from 'midi-writer-js'; 
import { ELITE_16_CHANNELS } from './maestroService';
import { theoryEngine } from './theoryEngine';
import { engineProfileService, getEngineStats } from './engineProfileService';

const INTERNAL_PPQ = 480;
const TICKS_PER_BAR = 1920;

const sortByTick = (a: any, b: any) => {
    const tA = a.startTick ?? a.tick ?? 0;
    const tB = b.startTick ?? b.tick ?? 0;
    return tA - tB;
};

const BASE_KEY_SHARPS: Record<string, number> = {
    'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7,
    'F': -1, 'BB': -2, 'EB': -3, 'AB': -4, 'DB': -5, 'GB': -6, 'CB': -7,
    'A#': -2, 'D#': -3, 'G#': -4
};

const MODE_OFFSETS: Record<string, number> = {
    'MAJOR': 0, 'MINOR': -3, 'PHRYGIAN': -4, 'DORIAN': -2, 'LYDIAN': 1, 'MIXOLYDIAN': -1, 'LOCRIAN': -5, 'HARMONIC': -3
};

const getKeySignatureData = (root: string, scale: string): { sharps: number, isMinor: boolean } => {
    let cleanRoot = theoryEngine.normalizeNote(root).replace(/\d/, ''); 
    const cleanScale = scale.toUpperCase().split(' ')[0];
    let modeOffset = 0;
    for (const [mode, offset] of Object.entries(MODE_OFFSETS)) {
        if (cleanScale.includes(mode)) { modeOffset = offset; break; }
    }
    const baseSharps = BASE_KEY_SHARPS[cleanRoot] !== undefined ? BASE_KEY_SHARPS[cleanRoot] : 0;
    const totalSharps = baseSharps + modeOffset;
    const isMinorLike = cleanScale.includes('MINOR') || cleanScale.includes('PHRYGIAN') || cleanScale.includes('DORIAN');
    return { sharps: totalSharps, isMinor: isMinorLike };
};

const sanitizeForWriter = (rawEvents: NoteEvent[], isForensic: boolean): NoteEvent[] => {
    const events = rawEvents.filter(n => n && (n.note || (n as any).pitch)).map(n => ({...n}));
    events.sort(sortByTick);
    if (events.length === 0) return [];
    if (isForensic) return events;
    const sanitized: NoteEvent[] = [];
    for (let i = 0; i < events.length; i++) {
        const current = events[i];
        if ((current.durationTicks || 0) <= 0) current.durationTicks = 120;
        const next = events[i + 1];
        if (next) {
            const currentStart = current.startTick || 0;
            const currentEnd = currentStart + (current.durationTicks || 120);
            const nextStart = next.startTick || 0;
            if (currentEnd > nextStart) {
                const newDur = Math.max(1, nextStart - currentStart);
                current.durationTicks = newDur;
            }
        }
        sanitized.push(current);
    }
    return sanitized;
};

const downloadMetadataReport = (groove: GrooveObject, fileNameBase: string, specificChannel?: ChannelKey) => {
    const timestamp = new Date().toLocaleString('he-IL');
    const safeName = (groove.name || "Untitled").toUpperCase();
    const bpm = groove.bpm || 140;
    const genre = groove.genre || "Unknown Genre";
    const engineStats = getEngineStats();

    let report = `============================================================\n`;
    report += `   OFFICIAL ENGINE REPORT | MIDI AI V120\n`;
    report += `============================================================\n\n`;
    report += `PROJECT IDENTITY:  ${safeName}\n`;
    report += `GENERATED BPM:     ${bpm}\n`;
    report += `SCALE/KEY:         ${groove.key} ${groove.scale}\n`;
    report += `------------------------------------------------------------\n`;
    report += `⚙️ ENGINE STATUS (EVIDENCE OF SYNTHESIS):\n`;
    report += `ENGINE CAPACITY:    ${engineStats.total} Units Persisted\n`;
    
    if (engineStats.total > 0) {
        report += `SYNTHESIS STATUS:    ACTIVE\n`;
        report += `ENGINE OVERRIDE:   ENABLED (Using user-uploaded patterns)\n`;
        report += `INFLUENCE SOURCE:  Internal Knowledge Base V38\n`;
        report += `NOTE: This MIDI was created by prioritizing rhythms from your\n`;
        report += `loaded library over standard factory algorithms.\n`;
    } else {
        report += `SYNTHESIS STATUS:    IDLE (No user files loaded yet)\n`;
    }
    
    report += `------------------------------------------------------------\n`;
    report += `TIMESTAMP:         ${timestamp}\n`;
    report += `ENGINE NODE:       Maestro V114.5\n`;
    report += `============================================================\n`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileNameBase}_INFO_REPORT.txt`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 500);
};

const TRACK_NAMES: Record<string, string> = {
    ch1_kick: '01 Kick',
    ch2_sub: '02 Sub Bass',
    ch3_midBass: '03 Mid Bass',
    ch4_leadA: '04 Lead A',
    ch5_leadB: '05 Lead B',
    ch6_arpA: '06 Arp A',
    ch7_arpB: '07 Arp B',
    ch8_snare: '08 Snare',
    ch9_clap: '09 Clap',
    ch10_percLoop: '10 Perc Loop',
    ch11_percTribal: '11 Perc Tribal',
    ch12_hhClosed: '12 HH Closed',
    ch13_hhOpen: '13 HH Open',
    ch14_acid: '14 Acid',
    ch15_pad: '15 Pad',
    ch16_synth: '16 Synth FX',
};

const DRUM_KEYS = new Set<ChannelKey>([
    'ch1_kick', 'ch8_snare', 'ch9_clap', 'ch10_percLoop', 'ch11_percTribal', 'ch12_hhClosed', 'ch13_hhOpen'
]);

/**
 * @tonejs/midi encodes the key-signature meta event as `keyIndex + 7` where the
 * Standard MIDI File spec wants the number of sharps/flats in -7..+7 (it should
 * be `keyIndex - 7`). The result is an out-of-range byte such as sf=20, and
 * strict readers - python mido / pretty_midi, several DAWs and AI tools -
 * reject the entire file. We repair the two bytes after encoding.
 */
const fixKeySignatureBytes = (bytes: Uint8Array, keySig: { sharps: number; isMinor: boolean } | null): Uint8Array => {
    for (let i = 0; i + 4 < bytes.length; i++) {
        if (bytes[i] === 0xff && bytes[i + 1] === 0x59 && bytes[i + 2] === 0x02) {
            const sf = keySig ? Math.max(-7, Math.min(7, keySig.sharps)) : 0;
            bytes[i + 3] = sf < 0 ? 256 + sf : sf;      // signed byte
            bytes[i + 4] = keySig?.isMinor ? 1 : 0;
        }
    }
    return bytes;
};

export interface ExportOptions {
    /** Write a single-track Format 0 file - the most widely compatible variant. */
    flatten?: boolean;
}

const asciiSafeName = (raw?: string) => {
    const cleaned = (raw || '')
        .replace(/[^\w\- ]+/g, '')   // drop non-ASCII / punctuation (Windows + DAW safe)
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 48);
    return cleaned || 'MIDI_AI_Track';
};

/** Allocates a unique MIDI channel per track: drums on 9 (GM), melodic on the rest. */
const allocateChannels = (keys: ChannelKey[]) => {
    const map = new Map<ChannelKey, number>();
    const free = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
    let next = 0;
    keys.forEach((key) => {
        if (DRUM_KEYS.has(key)) { map.set(key, 9); return; }
        map.set(key, free[next % free.length]);
        next++;
    });
    return map;
};

export const exportMidi = (groove: GrooveObject, selectedChannels?: ChannelKey[], options: ExportOptions = {}) => {
    try {
        const midi = new Midi();
        midi.header.setTempo(groove.bpm || 145);

        // Time signature + key signature make the file open correctly in a DAW
        // instead of defaulting to C major / unknown metre.
        let keySig: { sharps: number; isMinor: boolean } | null = null;
        try {
            (midi.header as any).timeSignatures = [{ ticks: 0, timeSignature: [4, 4] }];
            const parsedKey = getKeySignatureData(groove.key || 'C', groove.scale || 'Minor');
            if (parsedKey.sharps >= -7 && parsedKey.sharps <= 7) {
                keySig = parsedKey;
                (midi.header as any).keySignatures = [{
                    ticks: 0,
                    key: theoryEngine.normalizeNote(groove.key || 'C').replace(/\d/g, ''),
                    scale: parsedKey.isMinor ? 'minor' : 'major',
                }];
            }
        } catch (metaErr) {
            console.warn('[MIDI Export] skipped optional meta events', metaErr);
        }

        const active = ELITE_16_CHANNELS.filter((channelKey) => {
            if (selectedChannels && selectedChannels.length > 0 && !selectedChannels.includes(channelKey)) return false;
            const events = (groove as any)[channelKey] as NoteEvent[];
            return !!events && events.length > 0;
        });

        const channelMap = allocateChannels(active);
        let written = 0;

        const flatTrack = options.flatten ? midi.addTrack() : null;
        if (flatTrack) flatTrack.name = asciiSafeName(groove.name).replace(/_/g, ' ');

        active.forEach((channelKey) => {
            const rawEvents = (groove as any)[channelKey] as NoteEvent[];
            const track = flatTrack || midi.addTrack();
            if (!flatTrack) {
                track.name = TRACK_NAMES[channelKey] || channelKey;
                track.channel = channelMap.get(channelKey) ?? 0;
            } else {
                track.channel = 0;
            }

            rawEvents.forEach((n) => {
                const names = Array.isArray(n.note) ? n.note : [n.note];
                names.forEach((name) => {
                    if (!name) return;
                    const midiNum = theoryEngine.getMidiNote(name);
                    if (!Number.isFinite(midiNum) || midiNum < 0 || midiNum > 127) return;
                    track.addNote({
                        midi: Math.round(midiNum),
                        ticks: Math.max(0, Math.round(n.startTick || 0)),
                        durationTicks: Math.max(20, Math.round(n.durationTicks || 120)),
                        velocity: Math.max(0.2, Math.min(1, n.velocity || 0.8)),
                    });
                    written++;
                });
            });
        });

        if (written === 0) {
            console.warn('[MIDI Export] no notes to write');
            return { bytes: null, filename: 'empty.mid', noteCount: 0 };
        }

        const bytes = fixKeySignatureBytes(new Uint8Array(midi.toArray()), keySig);
        return { bytes, filename: `${asciiSafeName(groove.name)}.mid`, noteCount: written };
    } catch (e: any) {
        console.error('MIDI Export Error:', e);
        return { bytes: null, filename: 'error.mid', noteCount: 0 };
    }
};

/**
 * Plain-text rendering of the arrangement.
 * Chat assistants (Gemini, ChatGPT ...) cannot ingest a binary .mid - this is
 * the format to hand them for analysis.
 */
export const exportMidiAsText = (groove: GrooveObject): string => {
    const bpm = groove.bpm || 145;
    const ticksPerBeat = INTERNAL_PPQ;
    const lines: string[] = [];
    const active = ELITE_16_CHANNELS.filter((ch) => ((groove as any)[ch] || []).length > 0);
    const total = active.reduce((sum, ch) => sum + ((groove as any)[ch] as NoteEvent[]).length, 0);

    lines.push(`# ${groove.name || 'MIDI AI Track'}`);
    lines.push(`tempo_bpm: ${bpm}`);
    lines.push(`key: ${groove.key || '?'} ${groove.scale || ''}`.trim());
    lines.push(`time_signature: 4/4`);
    lines.push(`ticks_per_beat: ${ticksPerBeat}`);
    lines.push(`bars: ${groove.totalBars || 0}`);
    lines.push(`tracks: ${active.length}`);
    lines.push(`notes: ${total}`);
    lines.push('');
    lines.push('# columns: track,bar,beat,start_tick,length_ticks,note,midi,velocity');

    active.forEach((ch) => {
        const label = (TRACK_NAMES[ch] || ch).replace(/\s+/g, '_');
        const events = [...((groove as any)[ch] as NoteEvent[])].sort((a, b) => (a.startTick || 0) - (b.startTick || 0));
        events.forEach((n) => {
            const names = Array.isArray(n.note) ? n.note : [n.note];
            names.forEach((name) => {
                if (!name) return;
                const tick = Math.round(n.startTick || 0);
                const bar = Math.floor(tick / TICKS_PER_BAR) + 1;
                const beat = (tick % TICKS_PER_BAR) / INTERNAL_PPQ + 1;
                lines.push([
                    label,
                    bar,
                    beat.toFixed(2),
                    tick,
                    Math.round(n.durationTicks || 120),
                    name,
                    theoryEngine.getMidiNote(name),
                    Math.round((n.velocity ?? 0.8) * 127),
                ].join(','));
            });
        });
    });

    return lines.join('\n');
};

export const downloadMidiAsText = (groove: GrooveObject) => {
    const text = exportMidiAsText(groove);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${asciiSafeName(groove.name)}_notes.txt`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 500);
};

export const downloadFullArrangementMidi = async (
    groove: GrooveObject,
    opts: { report?: boolean; flatten?: boolean } = {}
) => {
    if (!groove) return;
    const result = exportMidi(groove, undefined, { flatten: opts.flatten });
    if (!result || !result.bytes) {
        alert('אין תווים לייצוא.');
        return;
    }
    // audio/midi makes some mobile browsers rename the download; octet-stream
    // keeps the .mid extension exactly as written.
    const blob = new Blob([result.bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 500);
    console.log(`[MIDI] exported ${result.filename} (${result.noteCount} notes, ${result.bytes.length} bytes)`);
    // The text report is opt-in: a second automatic download confuses phones and
    // ends up being the file people upload by mistake.
    if (opts.report) downloadMetadataReport(groove, result.filename.replace('.mid', ''));
};

export const downloadFullProjectMidi = downloadFullArrangementMidi;

export const downloadChannelMidi = (groove: GrooveObject, channelKey: ChannelKey) => {
    if (!groove) return;
    const { bytes } = exportMidi(groove, [channelKey]);
    if (!bytes) return;
    const filename = `${channelKey.replace('ch', '')}_${groove.bpm}BPM`;
    const blob = new Blob([bytes], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.mid`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 500);
    downloadMetadataReport(groove, filename, channelKey);
};

export const downloadAnalyzedMidi = async (segments: GrooveObject[]) => {
    if (!segments || segments.length === 0) return;
    const masterGroove: GrooveObject = { ...JSON.parse(JSON.stringify(segments[0])), id: `MERGED_${Date.now()}`, name: `AI_Transcription`, } as any;
    ELITE_16_CHANNELS.forEach(ch => { (masterGroove as any)[ch] = (segments || []).flatMap(seg => (seg as any)[ch] || []); });
    await downloadFullArrangementMidi(masterGroove);
};

const INTERNAL_FROM_FILE = (ticks: number, ppq: number) => Math.round((ticks * INTERNAL_PPQ) / Math.max(1, ppq));

const noteFromMidi = (midiNum: number, ticks: number, durationTicks: number, velocity: number): NoteEvent => {
    const startTick = Math.max(0, ticks);
    const bar = Math.floor(startTick / 1920);
    const beat = Math.floor((startTick % 1920) / 480);
    const sixteen = Math.floor((startTick % 480) / 120);
    return {
        note: theoryEngine.midiToNote(midiNum),
        duration: 'custom',
        durationTicks: Math.max(20, durationTicks || 120),
        startTick,
        time: `${bar}:${beat}:${sixteen}`,
        velocity: Math.max(0.25, Math.min(1, velocity || 0.8)),
    };
};

const resolveImportChannel = (trackName: string, channelIndex: number, midiNum?: number): ChannelKey => {
    const name = (trackName || '').toLowerCase().replace(/[_-]+/g, ' ');
    const rules: { key: ChannelKey; needles: string[] }[] = [
        { key: 'ch1_kick', needles: ['kick', 'bd ', ' bass drum'] },
        { key: 'ch2_sub', needles: ['sub'] },
        { key: 'ch3_midBass', needles: ['mid bass', 'midbass', 'baseline'] },
        { key: 'ch4_leadA', needles: ['lead a', 'hero', 'lead'] },
        { key: 'ch5_leadB', needles: ['lead b', 'harmony'] },
        { key: 'ch6_arpA', needles: ['arp a', 'arp'] },
        { key: 'ch7_arpB', needles: ['arp b'] },
        { key: 'ch8_snare', needles: ['snare', 'sd'] },
        { key: 'ch9_clap', needles: ['clap'] },
        { key: 'ch10_percLoop', needles: ['perc loop', 'perc'] },
        { key: 'ch11_percTribal', needles: ['tribal'] },
        { key: 'ch12_hhClosed', needles: ['hh closed', 'closed', 'hihat', 'hhc'] },
        { key: 'ch13_hhOpen', needles: ['hh open', 'open hat', 'hho'] },
        { key: 'ch14_acid', needles: ['acid', '303'] },
        { key: 'ch15_pad', needles: ['pad', 'atmos'] },
        { key: 'ch16_synth', needles: ['synth', 'fx'] },
    ];
    for (const rule of rules) {
        if (rule.needles.some((n) => name.includes(n))) return rule.key;
    }
    if (midiNum === 36) return 'ch1_kick';
    if (midiNum === 38) return 'ch8_snare';
    if (midiNum === 39) return 'ch9_clap';
    if (midiNum === 42) return 'ch12_hhClosed';
    if (midiNum === 46) return 'ch13_hhOpen';
    return ELITE_16_CHANNELS[Math.min(channelIndex, ELITE_16_CHANNELS.length - 1)];
};

export const importMidiNotesToTrack = async (file: File): Promise<NoteEvent[]> => {
    const { midi } = await loadMidiFile(file);
    const ppq = midi.header.ppq || 480;
    const events: NoteEvent[] = [];
    midi.tracks.forEach((track) => {
        track.notes.forEach((n) => {
            events.push(noteFromMidi(n.midi, INTERNAL_FROM_FILE(n.ticks, ppq), INTERNAL_FROM_FILE(n.durationTicks, ppq), n.velocity));
        });
    });
    return events;
};

export const importMidiAsGroove = async (file: File): Promise<{ groove: GrooveObject }> => {
    const { midi, info } = await loadMidiFile(file);
    const ppq = midi.header.ppq || 480;
    if (info.repaired.length) console.warn(`[MIDI] "${file.name}" needed repair:`, info.repaired);
    const bpm = Math.round(midi.header.tempos[0]?.bpm || 145);
    const groove: any = {
        id: `IMPORT_${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        bpm,
        key: 'F#',
        scale: 'Phrygian',
        totalBars: 32,
    };
    ELITE_16_CHANNELS.forEach((ch) => { groove[ch] = []; });

    let maxTick = 0;
    const used = new Set<ChannelKey>();
    midi.tracks.forEach((track, i) => {
        if (!track.notes.length) return;
        const first = track.notes[0];
        let target = resolveImportChannel(track.name || '', i, first?.midi);
        if (used.has(target) && !track.name) {
            target = ELITE_16_CHANNELS.find((ch) => !used.has(ch)) || target;
        }
        used.add(target);
        track.notes.forEach((n) => {
            const evn = noteFromMidi(n.midi, INTERNAL_FROM_FILE(n.ticks, ppq), INTERNAL_FROM_FILE(n.durationTicks, ppq), n.velocity);
            groove[target].push(evn);
            maxTick = Math.max(maxTick, (evn.startTick || 0) + (evn.durationTicks || 0));
        });
    });

    groove.totalBars = Math.max(8, Math.ceil(maxTick / 1920) + 1);
    const totalNotes = ELITE_16_CHANNELS.reduce((s, ch) => s + (groove[ch] as NoteEvent[]).length, 0);
    if (!totalNotes) throw new Error('הקובץ לא מכיל תווים שאפשר להשמיע.');
    return { groove: groove as GrooveObject };
};
