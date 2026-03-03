
import { Midi } from '@tonejs/midi';

export interface EditorNote {
    id: string; 
    pitch: number; // 0-127
    startTick: number;
    durationTicks: number;
    velocity: number; // 0-1
    trackIndex: number;
    isDrum: boolean;
    // V58: Expression Engine Support
    mod?: number; // CC1
    exp?: number; // CC11
}

export interface MidiEditorState {
    ppq: number;
    notes: EditorNote[];
    totalTicks: number;
    bpm: number;
    durationSeconds: number;
}

export const midiEditorService = {
    parseMidiFile: async (file: File): Promise<MidiEditorState> => {
        const arrayBuffer = await file.arrayBuffer();
        const midi = new Midi(arrayBuffer);
        
        const allNotes: EditorNote[] = [];
        let maxTick = 0;

        // Iterate all tracks
        midi.tracks.forEach((track, tIdx) => {
            const isDrum = track.instrument.percussion || track.channel === 9;

            track.notes.forEach((n, nIdx) => {
                const endTick = n.ticks + n.durationTicks;
                if (endTick > maxTick) maxTick = endTick;

                allNotes.push({
                    id: `n-${tIdx}-${nIdx}-${n.ticks}`, 
                    pitch: n.midi,
                    startTick: n.ticks,
                    durationTicks: n.durationTicks,
                    velocity: n.velocity,
                    trackIndex: tIdx,
                    isDrum: isDrum,
                    mod: 0, // Import defaulting (CC usually separate events in MIDI file, simplified here)
                    exp: 0
                });
            });
        });

        if (allNotes.length === 0) {
            throw new Error("Midi file contains no notes.");
        }

        allNotes.sort((a, b) => a.startTick - b.startTick);

        const ppq = midi.header.ppq || 480;
        const bpm = midi.header.tempos[0]?.bpm || 120;
        const totalTicks = Math.max(maxTick, ppq * 4 * 4); 

        return {
            ppq,
            notes: allNotes,
            totalTicks,
            bpm,
            durationSeconds: midi.duration
        };
    },

    exportMidiFile: (state: MidiEditorState): Blob => {
        const midi = new Midi();
        midi.header.setTempo(state.bpm);
        
        const melodicTrack = midi.addTrack();
        melodicTrack.channel = 0; 
        
        const drumTrack = midi.addTrack();
        drumTrack.channel = 9; 

        state.notes.forEach(n => {
            const target = n.isDrum ? drumTrack : melodicTrack;
            target.addNote({
                midi: n.pitch,
                ticks: n.startTick,
                durationTicks: n.durationTicks,
                velocity: n.velocity
            });
        });

        const array = midi.toArray();
        return new Blob([array], { type: "audio/midi" });
    }
};
