
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GrooveObject, NoteEvent, ChannelKey } from '../types';
import { audioService } from '../services/audioService';
import { StudioArrangement } from './StudioArrangement';
import { PianoRollEditor } from './PianoRollEditor';
import { MidiVisualizer } from './MidiVisualizer';
import { downloadFullArrangementMidi, importMidiAsGroove } from '../services/midiService';
import { ArrowLeft, Play, Pause, Maximize2, Minimize2, Plus, FastForward, Columns, Rows, ZoomIn, ZoomOut, FilePlus, Download } from 'lucide-react';
import { theoryEngine } from '../services/theoryEngine';
import * as Tone from 'tone';
import { ELITE_16_CHANNELS } from '../services/maestroService';

interface StudioPageProps {
    initialGroove: GrooveObject | null;
    onUpdate: (groove: GrooveObject) => void;
    onClose: () => void;
}

export const StudioPage: React.FC<StudioPageProps> = ({ initialGroove, onUpdate, onClose }) => {
    const createEmptyGroove = (): GrooveObject => {
        const g: any = {
            id: `EMPTY_${Date.now()}`,
            name: "New Session",
            bpm: 145,
            key: "F#",
            scale: "Phrygian",
            totalBars: 128
        };
        ELITE_16_CHANNELS.forEach(k => g[k] = []);
        return g;
    };

    const [groove, setGroove] = useState<GrooveObject>(initialGroove || createEmptyGroove());
    const [activeTrack, setActiveTrack] = useState<string | null>('ch4_leadA');
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackTime, setPlaybackTime] = useState(0);
    const [currentBpm, setCurrentBpm] = useState(groove.bpm || 145);
    const [isEditorMaximized, setIsEditorMaximized] = useState(false);
    const [editorHeight, setEditorHeight] = useState(window.innerWidth < 768 ? 220 : 320);
    const [focusPitch, setFocusPitch] = useState(60);
    const [focusTick, setFocusTick] = useState<number | undefined>(0);
    
    const [showVisualizer, setShowVisualizer] = useState(window.innerWidth >= 768);
    const [showSidebar, setShowSidebar] = useState(true); 
    const [showBottomEditor, setShowBottomEditor] = useState(true);
    const [isAudioInitialized, setIsAudioInitialized] = useState(false);
    const [timelineZoom, setTimelineZoom] = useState(window.innerWidth < 768 ? 40 : 120);

    useEffect(() => {
        let raf: number;
        const loop = () => {
            setPlaybackTime(Tone.Transport.seconds);
            setIsPlaying(Tone.Transport.state === 'started');
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, []);

    const totalSeconds = (groove.totalBars || 128) * (4 * (60 / currentBpm));

    const handleSeek = (time: number) => {
         Tone.Transport.seconds = Math.max(0, Math.min(time, totalSeconds));
        setPlaybackTime(Tone.Transport.seconds);
    };

    const syncEngine = async (g: GrooveObject) => {
        if (!isAudioInitialized || Tone.context.state !== 'running') {
            await audioService.ensureInit();
            setIsAudioInitialized(true);
        }
        audioService.setBpm(currentBpm);
        await audioService.scheduleSequence({ ...g, bpm: currentBpm });
    };

    const handlePlay = async () => {
        if (isPlaying) {
            audioService.stop();
        } else {
            await syncEngine(groove);
            audioService.play();
        }
    };

    const handleAudioRefresh = async () => {
        console.log("🔄 Sample change detected, refreshing engine...");
        // Re-syncing the entire engine to ensure the new Sampler is picked up by the Parts
        await syncEngine(groove);
    };

    const handleImportMidi = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const { groove: newGroove } = await importMidiAsGroove(file);
            setGroove(newGroove);
            onUpdate(newGroove);
            setCurrentBpm(newGroove.bpm || 145);
            if (isPlaying) await syncEngine(newGroove);
        } catch (err) {
            alert("Signal Error: " + err);
        } finally {
            e.target.value = '';
        }
    };

    const handleSelectTrack = (track: string, tick?: number) => {
        setActiveTrack(track);
        if (tick !== undefined) setFocusTick(tick);
        
        const notes = (groove as any)[track] as NoteEvent[];
        if (notes?.length > 0) {
            const targetNote = tick !== undefined ? (notes.find(n => (n.startTick || 0) >= tick) || notes[0]) : notes[0];
            const pitch = typeof targetNote.note === 'string' ? theoryEngine.getMidiNote(targetNote.note) : theoryEngine.getMidiNote(targetNote.note[0]);
            setFocusPitch(pitch);
        }
    };

    const handleUpdateTrack = async (track: string, notes: NoteEvent[]) => {
        const updatedGroove: any = { ...groove, [track]: notes };
        setGroove(updatedGroove);
        onUpdate(updatedGroove);
        if (isPlaying) await syncEngine(updatedGroove);
    };

    const isResizing = useRef(false);
    const startResizing = (e: any) => { 
        isResizing.current = true; 
        document.body.style.cursor = 'row-resize'; 
    };

    useEffect(() => {
        const handleMove = (e: any) => {
            if (!isResizing.current) return;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            setEditorHeight(Math.max(40, window.innerHeight - clientY - 80));
        };
        const handleUp = () => { isResizing.current = false; document.body.style.cursor = 'default'; };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleUp);
        return () => { 
            window.removeEventListener('mousemove', handleMove); 
            window.removeEventListener('mouseup', handleUp); 
            window.removeEventListener('touchmove', handleMove); 
            window.removeEventListener('touchend', handleUp); 
        };
    }, []);

    return (
        <div className="flex flex-col h-full bg-[#050507] text-[#E2E8F0] font-sans overflow-hidden select-none">
            <div className="h-14 md:h-16 shrink-0 bg-[#0A0A0B] border-b border-white/5 flex items-center justify-between px-2 md:px-6 z-[100] shadow-2xl">
                <div className="flex items-center gap-1 md:gap-4 overflow-hidden">
                    <button onClick={() => { audioService.stop(); onClose(); }} className="p-1.5 md:p-2 bg-white/5 hover:bg-white/10 rounded-lg md:rounded-xl transition-all text-gray-400">
                        <ArrowLeft size={16} className="md:w-[18px]" />
                    </button>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[7px] md:text-[9px] font-black uppercase tracking-[0.1em] md:tracking-[0.3em] text-sky-500 leading-none mb-0.5">STUDIO</span>
                        <h2 className="text-[9px] md:text-sm font-black uppercase tracking-tighter text-white truncate max-w-[60px] md:max-w-[200px]">{groove.name}</h2>
                    </div>
                </div>
                
                <div className="flex items-center gap-1.5 md:gap-4 shrink-0">
                    <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/10">
                        <button onClick={() => setShowSidebar(!showSidebar)} className={`p-1.5 rounded-md transition-all ${showSidebar ? 'bg-sky-500 text-black' : 'text-gray-500 hover:text-white'}`}>
                            <Columns size={12} />
                        </button>
                        <button onClick={() => setShowBottomEditor(!showBottomEditor)} className={`p-1.5 rounded-md transition-all ${showBottomEditor ? 'bg-sky-500 text-black' : 'text-gray-500 hover:text-white'}`}>
                            <Rows size={12} />
                        </button>
                    </div>

                    <div className="bg-black/40 px-2 py-1.5 rounded-lg border border-white/5">
                        <span className="text-[10px] md:text-[12px] font-mono text-sky-400 font-black">{currentBpm}<span className="hidden md:inline ml-1 text-[8px] opacity-40">BPM</span></span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 md:gap-3">
                        <label className="flex p-2 md:px-4 md:py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer items-center gap-1 shadow-lg">
                            <FilePlus size={12} /> <span className="hidden md:inline">Import</span>
                            <input type="file" className="hidden" accept=".mid,.midi" onChange={handleImportMidi} />
                        </label>
                        
                        <button onClick={() => downloadFullArrangementMidi(groove)} className="p-2 md:px-4 md:py-2 bg-white text-black hover:bg-zinc-200 rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all">
                            <Download size={12} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 relative">
                {showVisualizer && !isEditorMaximized && (
                    <div className="h-16 md:h-28 border-b border-black shrink-0 relative bg-black">
                        <MidiVisualizer groove={{...groove, bpm: currentBpm}} isPlaying={isPlaying} />
                        <button onClick={() => setShowVisualizer(false)} className="absolute top-1 right-1 p-1 bg-black/50 text-gray-500 hover:text-white rounded-md z-50"><Plus size={10} className="rotate-45" /></button>
                    </div>
                )}

                <div className={`flex-1 min-h-0 relative ${isEditorMaximized ? 'hidden' : ''}`}>
                    <StudioArrangement 
                        groove={{...groove, bpm: currentBpm}} activeTrack={activeTrack} 
                        onSelectTrack={handleSelectTrack} playbackTime={playbackTime}
                        onSeek={() => {}} onUpdateTrack={handleUpdateTrack}
                        onSampleLoad={handleAudioRefresh}
                        showSidebar={showSidebar}
                        pixelsPerBar={timelineZoom}
                        setTimelineZoom={setTimelineZoom}
                    />
                </div>

                {showBottomEditor && !isEditorMaximized && (
                    <div onMouseDown={startResizing} onTouchStart={startResizing} className="h-2 bg-[#18181B] hover:bg-sky-600 cursor-row-resize transition-all z-[110] flex items-center justify-center">
                        <div className="w-10 h-1 bg-white/10 rounded-full"></div>
                    </div>
                )}

                <div className={`bg-[#0A0A0C] flex flex-col transition-all duration-300 ${isEditorMaximized ? 'flex-1 h-full' : showBottomEditor ? 'border-t border-black' : 'h-0 opacity-0 overflow-hidden'}`} 
                    style={{ height: isEditorMaximized ? '100%' : showBottomEditor ? `${editorHeight}px` : '0px' }}>
                    
                    <div className="h-8 md:h-10 bg-[#111113] border-b border-white/5 flex items-center justify-between px-3 shrink-0">
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.1em] text-sky-400 truncate">
                            {activeTrack?.replace(/ch\d+_/, '').toUpperCase()} PIANO ROLL
                        </span>
                        <div className="flex items-center gap-1.5 md:gap-3">
                             <button onClick={() => setIsEditorMaximized(!isEditorMaximized)} className="p-1 text-zinc-500 hover:text-white bg-white/5 rounded-md border border-white/5">
                                {isEditorMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                            </button>
                            <button onClick={() => setShowBottomEditor(false)} className="p-1 text-zinc-500 hover:text-red-500">
                                <Plus size={12} className="rotate-45" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 relative overflow-hidden">
                        {activeTrack && (
                            <PianoRollEditor 
                                notes={((groove as any)[activeTrack] || []).map((n: any, i: number) => ({
                                    id: `n-${i}-${n.startTick}`,
                                    pitch: typeof n.note === 'string' ? theoryEngine.getMidiNote(n.note) : theoryEngine.getMidiNote(n.note[0]),
                                    startTick: n.startTick || 0,
                                    durationTicks: n.durationTicks || 120,
                                    velocity: n.velocity,
                                    trackIndex: 0,
                                    isDrum: activeTrack.includes('kick') || activeTrack.includes('snare') || activeTrack.includes('hh')
                                }))} ppq={480} totalTicks={(groove.totalBars || 128) * 1920}
                                onChange={(newNotes) => {
                                    const mapped = newNotes.map(n => ({
                                        note: theoryEngine.midiToNote(n.pitch),
                                        startTick: n.startTick,
                                        durationTicks: n.durationTicks,
                                        velocity: n.velocity,
                                        time: `${Math.floor(n.startTick/1920)}:${Math.floor((n.startTick%1920)/480)}:${Math.floor((n.startTick%480)/120)}`,
                                        duration: "custom"
                                    }));
                                    handleUpdateTrack(activeTrack, mapped);
                                }} playbackTime={playbackTime} bpm={currentBpm}
                                isMaximized={isEditorMaximized} onToggleMaximize={() => {}}
                                focusPitch={focusPitch} focusTick={focusTick}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Transport Bar */}
            <div className="h-16 md:h-24 bg-[#0A0A0B] border-t border-white/10 flex flex-col items-center justify-center gap-0.5 shrink-0 pb-safe z-[100] px-2 md:px-6">
                <input type="range" min="0" max={totalSeconds} step="0.1" value={playbackTime} onChange={(e) => handleSeek(parseFloat(e.target.value))} className="w-full max-w-6xl h-1 bg-zinc-900 rounded-full appearance-none accent-sky-500 cursor-pointer mb-1 md:mb-3" />
                <div className="flex items-center gap-4 md:gap-12">
                    <button onClick={() => handleSeek(0)} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/5 text-zinc-500 hover:text-white flex items-center justify-center transition-all">
                        <div className="w-2 h-2 bg-current rounded-sm"></div>
                    </button>
                    <button onClick={handlePlay} className={`w-10 h-10 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all shadow-2xl active:scale-90 ${isPlaying ? 'bg-white text-black' : 'bg-sky-600 text-white shadow-sky-500/20'}`}>
                        {isPlaying ? <Pause size={20} className="md:w-7 md:h-7" fill="currentColor" /> : <Play size={20} className="md:w-7 md:h-7 ml-0.5" fill="currentColor" />}
                    </button>
                    <button onClick={() => handleSeek(Math.min(totalSeconds, playbackTime + 5))} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/5 text-zinc-500 hover:text-white flex items-center justify-center transition-all">
                        <FastForward size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
