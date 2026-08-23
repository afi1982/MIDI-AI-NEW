
import { Midi } from '@tonejs/midi';
import { GrooveObject, NoteEvent, ChannelKey, ScaleType } from '../types.ts';
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

export const exportMidi = (groove: GrooveObject, selectedChannels?: ChannelKey[]) => {
    try {
        // Export via @tonejs/midi using ABSOLUTE ticks at the internal 480 PPQ.
        // The old midi-writer-js path ran at 128 PPQ with sequential "wait" deltas,
        // which (a) mismatched the studio grid and (b) serialised chord tones
        // one-after-another instead of stacking them.
        const midi = new Midi();
        midi.header.setTempo(groove.bpm || 140);
        midi.header.name = groove.name || 'MIDI AI Session';

        try {
            const keySig = getKeySignatureData(groove.key || 'C', groove.scale || 'Major');
            (midi.header as any).keySignatures = [{
                key: theoryEngine.normalizeNote(groove.key || 'C').replace(/\d/, ''),
                scale: keySig.isMinor ? 'minor' : 'major',
                ticks: 0
            }];
        } catch (e) { /* key signature is cosmetic */ }

        let written = 0;

        ELITE_16_CHANNELS.forEach((channelKey, i) => {
            if (selectedChannels && selectedChannels.length > 0 && !selectedChannels.includes(channelKey)) return;
            const rawEvents = (groove as any)[channelKey] as NoteEvent[];
            if (!rawEvents || rawEvents.length === 0) return;

            const track = midi.addTrack();
            track.name = channelKey;
            // Channel 9 (index) is reserved for GM drums; keep melodic parts off it
            track.channel = i < 9 ? i : i + 1;

            const events = [...rawEvents]
                .filter(n => n && (n.note || (n as any).pitch))
                .sort(sortByTick);

            events.forEach(n => {
                const ticks = Math.max(0, Math.round(n.startTick || 0));
                const durationTicks = Math.max(24, Math.round(n.durationTicks || 120));
                const velocity = Math.min(1, Math.max(0.05, n.velocity ?? 0.8));
                const pitches = Array.isArray(n.note) ? n.note : [n.note as string];

                pitches.forEach(p => {
                    if (!p) return;
                    try {
                        // Use MIDI numbers - normalizeNote() strips the octave, addNote(name) would misplace it
                        const midiNumber = theoryEngine.getMidiNote(p);
                        if (!Number.isFinite(midiNumber) || midiNumber < 0 || midiNumber > 127) return;
                        track.addNote({ midi: midiNumber, ticks, durationTicks, velocity });
                        written++;
                    } catch (err) {
                        console.warn('[MIDI Export] skipped invalid note', p, err);
                    }
                });
            });
        });

        if (written === 0) {
            console.warn('[MIDI Export] nothing to export - all channels empty');
        }

        return { bytes: midi.toArray(), filename: `${groove.name || 'session'}.mid`, noteCount: written };
    } catch (e: any) {
        console.error("MIDI Export Error:", e);
        return { bytes: null, filename: 'error.mid', noteCount: 0 };
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

/**
 * Files written by this app (midi-writer-js) use PPQ 128, Audio-To-MIDI / DAW
 * exports commonly use 96, 192, 384, 480 or 960.
 * Every tick coming from a file MUST be rescaled to the internal 480 PPQ grid,
 * otherwise notes are crushed into the first bar with ~20ms durations
 * (= "the studio plays nothing").
 */
const getTickScale = (midi: Midi): number => {
    const filePpq = midi.header?.ppq || INTERNAL_PPQ;
    if (!filePpq || filePpq <= 0) return 1;
    return INTERNAL_PPQ / filePpq;
};

const MIN_DURATION_TICKS = 60;      // 1/32 note @480ppq - anything shorter is inaudible
const MIN_VELOCITY = 0.35;          // Audio-To-MIDI often outputs near-zero velocities

const toNoteEvent = (n: any, scale: number): NoteEvent => {
    const startTick = Math.max(0, Math.round((n.ticks || 0) * scale));
    const rawDur = Math.round((n.durationTicks || 0) * scale);
    const durationTicks = Math.max(MIN_DURATION_TICKS, rawDur || 0);
    const bar = Math.floor(startTick / TICKS_PER_BAR);
    const beat = Math.floor((startTick % TICKS_PER_BAR) / INTERNAL_PPQ);
    const sixteen = Math.floor((startTick % INTERNAL_PPQ) / 120);
    const velocity = Math.min(1, Math.max(MIN_VELOCITY, n.velocity ?? 0.8));
    return {
        note: theoryEngine.midiToNote(n.midi),
        duration: "custom",
        durationTicks,
        startTick,
        time: `${bar}:${beat}:${sixteen}`,
        velocity
    } as NoteEvent;
};

export const importMidiNotesToTrack = async (file: File): Promise<NoteEvent[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const midi = new Midi(arrayBuffer);
    const scale = getTickScale(midi);
    const events: NoteEvent[] = [];
    midi.tracks.forEach(track => {
        track.notes.forEach(n => events.push(toNoteEvent(n, scale)));
    });
    return events.sort(sortByTick);
};

const DRUM_CHANNELS: ChannelKey[] = ['ch1_kick', 'ch8_snare', 'ch9_clap', 'ch12_hhClosed', 'ch13_hhOpen', 'ch10_percLoop', 'ch11_percTribal'] as ChannelKey[];
const MELODIC_FALLBACKS: ChannelKey[] = ['ch4_leadA', 'ch5_leadB', 'ch16_synth', 'ch6_arpA', 'ch7_arpB', 'ch15_pad', 'ch14_acid'] as ChannelKey[];
const BASS_FALLBACKS: ChannelKey[] = ['ch3_midBass', 'ch2_sub'] as ChannelKey[];

const matchChannelByName = (rawName: string): ChannelKey | null => {
    const name = (rawName || '').toLowerCase();
    if (!name) return null;
    for (const key of ELITE_16_CHANNELS) {
        const alias = key.split('_')[1].toLowerCase();
        if (name.includes(key.toLowerCase()) || name.includes(alias)) return key;
    }
    // Common DAW / transcription naming
    if (/kick|bd\b/.test(name)) return 'ch1_kick' as ChannelKey;
    if (/snare|sd\b/.test(name)) return 'ch8_snare' as ChannelKey;
    if (/clap/.test(name)) return 'ch9_clap' as ChannelKey;
    if (/hat|hh/.test(name)) return 'ch12_hhClosed' as ChannelKey;
    if (/perc|tom|ride|crash/.test(name)) return 'ch10_percLoop' as ChannelKey;
    if (/sub/.test(name)) return 'ch2_sub' as ChannelKey;
    if (/bass|808/.test(name)) return 'ch3_midBass' as ChannelKey;
    if (/pad|string|atmo/.test(name)) return 'ch15_pad' as ChannelKey;
    if (/arp/.test(name)) return 'ch6_arpA' as ChannelKey;
    if (/acid|303/.test(name)) return 'ch14_acid' as ChannelKey;
    if (/lead|melody|vocal|voice|piano|guitar|synth|pluck/.test(name)) return 'ch4_leadA' as ChannelKey;
    return null;
};

export const importMidiAsGroove = async (file: File): Promise<{ groove: GrooveObject }> => {
    const arrayBuffer = await file.arrayBuffer();
    const midi = new Midi(arrayBuffer);
    const scale = getTickScale(midi);
    const bpm = midi.header.tempos[0]?.bpm || 145;

    const groove: any = {
        id: `IMPORT_${Date.now()}`,
        name: file.name.replace(/\.(mid|midi)$/i, '') || 'Imported',
        bpm: Math.round(bpm),
        key: "C",
        scale: "Minor",
        totalBars: 4
    };
    ELITE_16_CHANNELS.forEach(ch => groove[ch] = []);

    const used = new Set<ChannelKey>();
    let melodicCursor = 0;
    let bassCursor = 0;
    let drumCursor = 0;
    let maxTick = 0;
    let importedNotes = 0;

    // Skip empty tracks and the metadata "Conductor" track we write on export
    const playable = midi.tracks.filter(t =>
        t.notes.length > 0 && !/conductor|tempo|marker/i.test(t.name || '')
    );

    playable.forEach(track => {
        const isPercussion = track.channel === 9 || (track as any).instrument?.percussion;
        const avgMidi = track.notes.reduce((s, n) => s + n.midi, 0) / track.notes.length;

        let targetChannel = matchChannelByName(track.name) || matchChannelByName((track as any).instrument?.name || '');

        if (!targetChannel) {
            if (isPercussion) {
                targetChannel = DRUM_CHANNELS[drumCursor++ % DRUM_CHANNELS.length];
            } else if (avgMidi < 48) {
                // Low register -> bass, NEVER onto the kick channel (MembraneSynth = inaudible melody)
                targetChannel = BASS_FALLBACKS[bassCursor++ % BASS_FALLBACKS.length];
            } else {
                targetChannel = MELODIC_FALLBACKS[melodicCursor++ % MELODIC_FALLBACKS.length];
            }
        }

        // Avoid stacking two different tracks on the same channel when free slots exist
        if (used.has(targetChannel) && !isPercussion) {
            const pool = avgMidi < 48 ? BASS_FALLBACKS : MELODIC_FALLBACKS;
            const free = pool.find(c => !used.has(c));
            if (free) targetChannel = free;
        }
        used.add(targetChannel);

        const notes = track.notes
            .map(n => toNoteEvent(n, scale))
            .sort(sortByTick);

        notes.forEach(n => {
            const end = (n.startTick || 0) + (n.durationTicks || 0);
            if (end > maxTick) maxTick = end;
        });

        importedNotes += notes.length;
        groove[targetChannel] = [...(groove[targetChannel] || []), ...notes].sort(sortByTick);
    });

    if (importedNotes === 0) {
        throw new Error("No playable notes were found in this MIDI file.");
    }

    groove.totalBars = Math.max(4, Math.ceil(maxTick / TICKS_PER_BAR));
    groove.meta = { importedNotes, sourcePpq: midi.header?.ppq || INTERNAL_PPQ, sourceFile: file.name };

    return { groove: groove as GrooveObject };
};
