
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as Tone from 'tone';
import { midiEditorService, MidiEditorState, EditorNote } from '../services/midiEditorService.ts';
import { PianoRollEditor } from '../components/PianoRollEditor.tsx';
import { Play, Pause, Square, Upload, Download, ArrowLeft, Grid3X3, AlertCircle } from 'lucide-react';

interface MidiEditorPageProps {
    onClose: () => void;
}

const MidiEditorPage: React.FC<MidiEditorPageProps> = ({ onClose }) => {
    const [editorState, setEditorState] = useState<MidiEditorState | null>(null);
    const [editorKey, setEditorKey] = useState<number>(0); 
    const [error, setError] = useState<string | null>(null);
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackTime, setPlaybackTime] = useState(0);
    const [snapGrid, setSnapGrid] = useState(4); // 1/16th
    const [isMaximized, setIsMaximized] = useState(false);

    const polySynth = useRef<any>(null);
    const drumSynth = useRef<any>(null);
    const metalSynth = useRef<any>(null);
    const mainPart = useRef<any>(null);
    const limiter = useRef<any>(null);
    const isMounted = useRef<boolean>(true);

    useEffect(() => {
        isMounted.current = true;
        limiter.current = new Tone.Limiter(-6).toDestination();

        polySynth.current = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.5 },
            volume: -12
        }).connect(limiter.current);

        drumSynth.current = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 4,
            envelope: { attack: 0.005, decay: 0.4, sustain: 0.01, release: 1.4 },
            volume: -8
        }).connect(limiter.current);

        metalSynth.current = new Tone.MetalSynth({
            envelope: { attack: 0.005, decay: 0.1, release: 0.01 },
            harmonicity: 5.1,
            modulationIndex: 32,
            volume: -14
        }).connect(limiter.current);

        if (metalSynth.current) {
            metalSynth.current.frequency.value = 200;
        }

        return () => {
            isMounted.current = false;
            try {
                Tone.Transport.stop();
                Tone.Transport.cancel(0);
                
                if (mainPart.current) {
                    const part = mainPart.current;
                    mainPart.current = null;
                    if (part && !part.disposed) {
                        part.stop();
                        part.dispose();
                    }
                }

                [polySynth, drumSynth, metalSynth, limiter].forEach(ref => {
                    const node = ref.current;
                    ref.current = null; // Nullify first
                    if (node && !node.disposed) {
                        try {
                            if (typeof node.releaseAll === 'function') node.releaseAll();
                            node.dispose();
                        } catch(e) {}
                    }
                });
            } catch (e) {}
        };
    }, []);

    useEffect(() => {
        let frameId: number;
        const loop = () => {
            if (Tone.Transport.state === 'started') {
                setPlaybackTime(Tone.Transport.seconds);
                setIsPlaying(true);
            } else {
                setIsPlaying(false);
            }
            frameId = requestAnimationFrame(loop);
        };
        frameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId);
    }, []);

    useEffect(() => {
        if (!editorState) return;
        
        try {
            Tone.Transport.stop();
            Tone.Transport.cancel(0); 
            if (mainPart.current) {
                const part = mainPart.current;
                mainPart.current = null;
                if (part && !part.disposed) {
                    part.stop();
                    part.dispose();
                }
            }

            Tone.Transport.bpm.value = editorState.bpm;
            const ppqScale = 480 / editorState.ppq; 

            const events: any[] = [];
            for (const n of editorState.notes) {
                events.push({
                    time: (n.startTick * ppqScale) + "i",
                    note: Tone.Frequency(n.pitch, "midi").toNote(),
                    duration: Math.max(1, n.durationTicks * ppqScale) + "i",
                    velocity: Math.min(0.8, n.velocity * 0.8),
                    isDrum: n.isDrum,
                    pitch: n.pitch
                });
            }

            mainPart.current = new Tone.Part((time, val) => {
                if (!isMounted.current) return;
                try {
                    const dSynth = drumSynth.current;
                    const mSynth = metalSynth.current;
                    const pSynth = polySynth.current;

                    if (val.isDrum) {
                        if (val.pitch < 45) { 
                            if (dSynth && !dSynth.disposed && typeof dSynth.triggerAttackRelease === 'function') dSynth.triggerAttackRelease(val.note, "16n", time, val.velocity);
                        } else { 
                            if (mSynth && !mSynth.disposed && typeof mSynth.triggerAttackRelease === 'function') mSynth.triggerAttackRelease(val.note, "32n", time, val.velocity);
                        }
                    } else {
                        if (pSynth && !pSynth.disposed && typeof pSynth.triggerAttackRelease === 'function') pSynth.triggerAttackRelease(val.note, val.duration, time, val.velocity);
                    }
                } catch (e) {
                    // Silent catch to handle race conditions where Transport fires during cleanup
                }
            }, events).start(0);

            Tone.Transport.setLoopPoints(0, (editorState.totalTicks * ppqScale) + "i");
            Tone.Transport.loop = false;
        } catch (e) {
            console.error("[MidiEditor] Part scheduling error:", e);
        }

    }, [editorState]);

    const onDropMidi = useCallback(async (acceptedFiles: File[]) => {
        setError(null);
        try {
            const file = acceptedFiles[0];
            if (!file) return;
            const state = await midiEditorService.parseMidiFile(file);
            setEditorState(state);
            setEditorKey(Date.now());
            Tone.Transport.stop();
            Tone.Transport.cancel(0);
            setPlaybackTime(0);
        } catch (e: any) {
            setError(e.message || "Failed to parse MIDI.");
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: onDropMidi,
        accept: { 'audio/midi': ['.mid', '.midi'] },
        maxFiles: 1,
        noClick: !!editorState 
    } as any);

    const handleNotesChange = (newNotes: EditorNote[]) => {
        if (!editorState) return;
        const lastTick = Math.max(...newNotes.map(n => n.startTick + n.durationTicks), editorState.ppq * 4);
        setEditorState({ ...editorState, notes: newNotes, totalTicks: lastTick });
    };

    const togglePlay = async () => {
        await Tone.start();
        if (Tone.Transport.state === 'started') {
            Tone.Transport.pause();
        } else {
            Tone.Transport.start();
        }
    };

    const handleStop = () => {
        Tone.Transport.stop();
        Tone.Transport.seconds = 0;
        setPlaybackTime(0);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            Tone.Transport.seconds = val;
            setPlaybackTime(val);
        }
    };

    const handleExport = () => {
        if (!editorState) return;
        const blob = midiEditorService.exportMidiFile(editorState);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `MidiForge_${Date.now()}.mid`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#050507] text-white overflow-hidden font-sans">
            <div className="h-14 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-4 shrink-0 z-30">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><ArrowLeft size={18} /></button>
                    <h1 className="text-sm font-black uppercase text-studio-accent tracking-widest">Midi Forge V3.0</h1>
                </div>
                
                <div className="flex gap-2 items-center">
                    <button onClick={() => setSnapGrid(prev => prev === 4 ? 2 : prev === 2 ? 8 : 4)} className="flex items-center gap-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded text-[10px] font-bold font-mono text-studio-accent">
                        <Grid3X3 size={14} /> 1/{16 / (4/snapGrid)}
                    </button>
                    {editorState && (
                        <button onClick={handleExport} className="p-2 rounded bg-studio-accent text-black hover:scale-105 transition-transform"><Download size={16} /></button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative bg-[#121214]" {...(!editorState ? getRootProps() : {})}>
                {!editorState ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95">
                        <div className={`w-64 h-64 rounded-full border-2 border-dashed flex flex-col items-center justify-center transition-all mb-6 ${isDragActive ? 'border-studio-accent bg-studio-accent/10' : 'border-white/10 bg-white/5'}`}>
                            <Upload className="w-12 h-12 mb-4 text-gray-500" />
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-300">Drop MIDI File</p>
                        </div>
                        <input {...getInputProps()} />
                        {error && <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 px-4 py-2 rounded"><AlertCircle size={14} />{error}</div>}
                    </div>
                ) : (
                    <PianoRollEditor 
                        key={editorKey}
                        notes={editorState.notes}
                        ppq={editorState.ppq}
                        totalTicks={editorState.totalTicks}
                        onChange={handleNotesChange}
                        playbackTime={playbackTime}
                        bpm={editorState.bpm}
                        isMaximized={isMaximized}
                        onToggleMaximize={() => setIsMaximized(!isMaximized)}
                    />
                )}
            </div>

            {editorState && (
                <div className="h-20 bg-[#0A0A0B] border-t border-white/10 flex items-center justify-between px-6 gap-4 shrink-0 pb-safe z-40">
                    <div className="flex items-center gap-4">
                        <button onClick={handleStop} className="w-10 h-10 rounded-full bg-[#222] text-gray-400 flex items-center justify-center hover:text-white"><Square size={16} fill="currentColor" /></button>
                        <button onClick={togglePlay} className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-glow">
                            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                        </button>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-center mx-4">
                        <input 
                            type="range" 
                            min="0" 
                            max={editorState.durationSeconds || 60} 
                            step="0.01"
                            value={playbackTime} 
                            onChange={handleSeek}
                            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-studio-accent hover:accent-white"
                        />
                        <div className="flex justify-between mt-1">
                            <span className="text-[10px] font-mono text-studio-accent">{playbackTime.toFixed(1)}s</span>
                            <span className="text-[10px] font-mono text-gray-500">{(editorState.durationSeconds || 0).toFixed(1)}s</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MidiEditorPage;
