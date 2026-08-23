
import { Midi } from '@tonejs/midi';
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

export const exportMidi = (groove: GrooveObject, selectedChannels?: ChannelKey[]) => {
    try {
        const midi = new Midi();
        midi.header.setTempo(groove.bpm || 145);

        ELITE_16_CHANNELS.forEach((channelKey, i) => {
            if (selectedChannels && selectedChannels.length > 0 && !selectedChannels.includes(channelKey)) return;
            const rawEvents = (groove as any)[channelKey] as NoteEvent[];
            if (!rawEvents || rawEvents.length === 0) return;

            const track = midi.addTrack();
            track.name = TRACK_NAMES[channelKey] || channelKey;
            track.channel = DRUM_KEYS.has(channelKey) ? 9 : i;

            rawEvents.forEach((n) => {
                const name = Array.isArray(n.note) ? n.note[0] : n.note;
                if (!name) return;
                const midiNum = theoryEngine.getMidiNote(name);
                if (!Number.isFinite(midiNum)) return;
                track.addNote({
                    midi: midiNum,
                    ticks: Math.max(0, n.startTick || 0),
                    durationTicks: Math.max(20, n.durationTicks || 120),
                    velocity: Math.max(0.2, Math.min(1, n.velocity || 0.8)),
                });
            });
        });

        const safeName = (groove.name || 'MIDI_AI_Track').replace(/[^\w\- ]+/g, '').trim() || 'MIDI_AI_Track';
        return { bytes: new Uint8Array(midi.toArray()), filename: `${safeName}.mid` };
    } catch (e: any) {
        console.error('MIDI Export Error:', e);
        return { bytes: null, filename: 'error.mid' };
    }
};

export const downloadFullArrangementMidi = async (groove: GrooveObject) => {
    if (!groove) return;
    const result = exportMidi(groove);
    if (!result || !result.bytes) return;
    const blob = new Blob([result.bytes], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link); 
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 500);
    downloadMetadataReport(groove, result.filename.replace('.mid', ''));
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

export const importMidiNotesToTrack = async (file: File): Promise<NoteEvent[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const midi = new Midi(arrayBuffer);
    const events: NoteEvent[] = [];
    midi.tracks.forEach(track => {
        track.notes.forEach(n => {
            const bar = Math.floor(n.ticks / 1920);
            const beat = Math.floor((n.ticks % 1920) / 480);
            const sixteen = Math.floor((n.ticks % 480) / 120);
            events.push({ note: theoryEngine.midiToNote(n.midi), duration: "custom", durationTicks: n.durationTicks, startTick: n.ticks, time: `${bar}:${beat}:${sixteen}`, velocity: n.velocity });
        });
    });
    return events;
};

export const importMidiAsGroove = async (file: File): Promise<{ groove: GrooveObject }> => {
    const arrayBuffer = await file.arrayBuffer();
    const midi = new Midi(arrayBuffer);
    const bpm = midi.header.tempos[0]?.bpm || 145;
    const groove: any = { id: `IMPORT_${Date.now()}`, name: file.name.split('.')[0], bpm: Math.round(bpm), key: "C", scale: "Minor", totalBars: Math.ceil(midi.durationTicks / 1920) };
    ELITE_16_CHANNELS.forEach(ch => groove[ch] = []);
    midi.tracks.forEach((track, i) => {
        const trackName = track.name.toLowerCase();
        let targetChannel: ChannelKey | null = null;
        for (const key of ELITE_16_CHANNELS) { if (trackName.includes(key.toLowerCase()) || trackName.includes(key.split('_')[1].toLowerCase())) { targetChannel = key; break; } }
        if (!targetChannel && i < ELITE_16_CHANNELS.length) { targetChannel = ELITE_16_CHANNELS[i]; }
        if (targetChannel) {
            const notes = track.notes.map(n => {
                const bar = Math.floor(n.ticks / 1920);
                const beat = Math.floor((n.ticks % 1920) / 480);
                const sixteen = Math.floor((n.ticks % 480) / 120);
                return { note: theoryEngine.midiToNote(n.midi), duration: "custom", durationTicks: n.durationTicks, startTick: n.ticks, time: `${bar}:${beat}:${sixteen}`, velocity: n.velocity };
            });
            groove[targetChannel] = [...(groove[targetChannel] || []), ...notes];
        }
    });
    return { groove: groove as GrooveObject };
};
