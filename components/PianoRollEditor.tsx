
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EditorNote } from '../services/midiEditorService';
import { ZoomIn, ZoomOut, Music, MoveHorizontal, MoveVertical } from 'lucide-react';

interface PianoRollEditorProps {
    notes: EditorNote[];
    ppq: number;
    totalTicks: number;
    onChange: (notes: EditorNote[]) => void;
    playbackTime: number;
    bpm: number;
    trackName?: string;
    isDrum?: boolean;
    isMaximized: boolean;
    onToggleMaximize: () => void;
    focusTick?: number;
    focusPitch?: number;
}

const ROW_HEIGHT = 18; 
const KEY_WIDTH = 54;
const RULER_HEIGHT = 24;

const THEME = {
    bg: '#141415',
    rowBlackKey: '#0D0D0E',
    rowWhiteKey: '#141415',
    gridBar: '#3A3A3B',
    gridBeat: '#252526',
    grid16th: '#1A1A1B',
    noteFill: '#D946EF',
    noteDrum: '#EAB308',
    playhead: '#00FF41'
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const PianoRollEditor: React.FC<PianoRollEditorProps> = ({ 
    notes, ppq, totalTicks, playbackTime, bpm, trackName, isDrum, focusPitch, focusTick 
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
    const keysCanvasRef = useRef<HTMLCanvasElement>(null);
    
    const [zoom, setZoom] = useState(0.2); 
    const [scrollX, setScrollX] = useState(0);
    const [scrollY, setScrollY] = useState(isDrum ? 1700 : 1100); 
    const [dims, setDims] = useState({ w: 800, h: 400 });

    // Panning State
    const [isPanning, setIsPanning] = useState(false);
    const dragLastPos = useRef({ x: 0, y: 0 });

    // Focus Pitch Logic
    useEffect(() => {
        if (focusPitch) {
            const y = (127 - focusPitch) * ROW_HEIGHT - (dims.h / 2);
            setScrollY(Math.max(0, Math.min(127 * ROW_HEIGHT - dims.h, y)));
        } else if (notes.length > 0) {
            const y = (127 - notes[0].pitch) * ROW_HEIGHT - (dims.h / 2);
            setScrollY(Math.max(0, Math.min(127 * ROW_HEIGHT - dims.h, y)));
        }
    }, [focusPitch, notes.length === 0, dims.h]);

    // Focus Tick Logic (Horizontal Scroll)
    useEffect(() => {
        if (focusTick !== undefined) {
            const x = (focusTick * zoom) - (dims.w * 0.1); // Position focus at 10% from left
            setScrollX(Math.max(0, Math.min(totalTicks * zoom - dims.w, x)));
        }
    }, [focusTick, zoom, dims.w, totalTicks]);

    const handleWheel = (e: React.WheelEvent) => {
        if (e.shiftKey) {
            setScrollX(prev => Math.max(0, Math.min(totalTicks * zoom - dims.w, prev + e.deltaY)));
        } else {
            setScrollY(prev => Math.max(0, Math.min(127 * ROW_HEIGHT - dims.h, prev + e.deltaY)));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Allow left click panning if alt or space is held, or just middle click
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            setIsPanning(true);
            dragLastPos.current = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanning) return;
        
        const dx = e.clientX - dragLastPos.current.x;
        const dy = e.clientY - dragLastPos.current.y;
        
        setScrollX(prev => Math.max(0, Math.min(totalTicks * zoom - dims.w, prev - dx)));
        setScrollY(prev => Math.max(0, Math.min(127 * ROW_HEIGHT - dims.h, prev - dy)));
        
        dragLastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    useEffect(() => {
        const resizer = new ResizeObserver(entries => {
            for (const entry of entries) setDims({ w: entry.contentRect.width - KEY_WIDTH - 12, h: entry.contentRect.height - RULER_HEIGHT });
        });
        if (containerRef.current) resizer.observe(containerRef.current);
        return () => resizer.disconnect();
    }, []);

    const setupCanvas = (canvas: HTMLCanvasElement, w: number, h: number) => {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = w * dpr; canvas.height = h * dpr;
        canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) { ctx.resetTransform(); ctx.scale(dpr, dpr); }
        return ctx;
    };

    const render = useCallback(() => {
        const main = mainCanvasRef.current; const keys = keysCanvasRef.current; const ruler = rulerCanvasRef.current;
        if (!main || !keys || !ruler || dims.w <= 0 || dims.h <= 0) return;
        const ctx = setupCanvas(main, dims.w, dims.h); const rCtx = setupCanvas(ruler, dims.w, RULER_HEIGHT); const kCtx = setupCanvas(keys, KEY_WIDTH, dims.h);
        if (!ctx || !rCtx || !kCtx) return;

        // Background
        ctx.fillStyle = THEME.bg; ctx.fillRect(0, 0, dims.w, dims.h);
        const startRow = Math.floor(scrollY / ROW_HEIGHT); 
        const endRow = startRow + Math.ceil(dims.h / ROW_HEIGHT) + 1;
        
        for (let i = startRow; i < endRow; i++) {
            const pitch = 127 - i; const y = (i * ROW_HEIGHT) - scrollY;
            if (pitch < 0 || pitch > 127) continue;
            ctx.fillStyle = NOTE_NAMES[pitch % 12].includes('#') ? THEME.rowBlackKey : THEME.rowWhiteKey;
            ctx.fillRect(0, y, dims.w, ROW_HEIGHT);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.strokeRect(0, y, dims.w, ROW_HEIGHT);
            
            // Keys Sidebar
            kCtx.fillStyle = NOTE_NAMES[pitch % 12].includes('#') ? '#111' : '#EEE';
            kCtx.fillRect(0, y, KEY_WIDTH, ROW_HEIGHT);
            kCtx.fillStyle = '#666'; kCtx.font = '8px mono';
            if (pitch % 12 === 0) kCtx.fillText(`C${Math.floor(pitch/12)-1}`, 5, y + 12);
        }

        // Grid
        const ticksPer16 = ppq / 4;
        const startStep = Math.floor(scrollX / (ticksPer16 * zoom));
        const endStep = startStep + Math.ceil(dims.w / (ticksPer16 * zoom));
        for (let i = startStep; i <= endStep; i++) {
            const x = (i * ticksPer16 * zoom) - scrollX;
            ctx.strokeStyle = (i % 16 === 0) ? THEME.gridBar : (i % 4 === 0) ? THEME.gridBeat : THEME.grid16th;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dims.h); ctx.stroke();
        }

        // Notes
        notes.forEach(note => {
            const x = (note.startTick * zoom) - scrollX; 
            const y = (127 - note.pitch) * ROW_HEIGHT - scrollY;
            const width = Math.max(4, note.durationTicks * zoom);
            if (x + width < 0 || x > dims.w || y + ROW_HEIGHT < 0 || y > dims.h) return;
            ctx.fillStyle = isDrum ? THEME.noteDrum : THEME.noteFill;
            ctx.shadowBlur = 4; ctx.shadowColor = 'black';
            ctx.fillRect(x + 1, y + 1, width - 2, ROW_HEIGHT - 2);
            ctx.shadowBlur = 0;
        });

        // Playhead
        const playTick = (playbackTime * (bpm / 60)) * ppq;
        const playPx = (playTick * zoom) - scrollX;
        if (playPx >= 0 && playPx <= dims.w) {
            ctx.strokeStyle = THEME.playhead; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(playPx, 0); ctx.lineTo(playPx, dims.h); ctx.stroke();
        }
    }, [dims, notes, playbackTime, scrollX, scrollY, zoom, ppq, bpm, isDrum]);

    useEffect(() => { 
        let raf = requestAnimationFrame(function loop() { render(); raf = requestAnimationFrame(loop); }); 
        return () => cancelAnimationFrame(raf); 
    }, [render]);

    return (
        <div 
            className="flex flex-col h-full w-full bg-[#141415] select-none overflow-hidden relative" 
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            data-no-swipe="true"
        >
            <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative">
                <div className="h-[24px] shrink-0 flex border-b border-black">
                    <div className="bg-[#2D2D2E] border-r border-black shrink-0" style={{ width: KEY_WIDTH }}></div>
                    <canvas ref={rulerCanvasRef} className="flex-1" />
                </div>
                <div className="flex-1 flex overflow-hidden relative">
                    <canvas ref={keysCanvasRef} className="z-20 border-r border-black shrink-0" width={KEY_WIDTH} />
                    <div className="flex-1 relative overflow-hidden">
                        <canvas ref={mainCanvasRef} className="absolute inset-0" />
                    </div>
                    {/* Vertical Scrollbar */}
                    <div className="w-3 shrink-0 bg-black/40 border-l border-black flex items-center justify-center p-0.5">
                        <input 
                            type="range" 
                            min="0" 
                            max={127 * ROW_HEIGHT - dims.h} 
                            step="1"
                            value={scrollY}
                            onChange={(e) => setScrollY(parseInt(e.target.value))}
                            className="h-full w-full appearance-none bg-zinc-800 rounded-full cursor-pointer accent-fuchsia-600 orientation-vertical"
                            style={{ WebkitAppearance: 'slider-vertical' } as any}
                        />
                    </div>
                </div>
            </div>
            <div className="h-4 md:h-6 bg-[#1A1A1B] border-t border-black flex items-center px-2">
                <div style={{ width: KEY_WIDTH }} className="shrink-0"></div>
                <input type="range" min="0" max="1" step="0.0001" value={scrollX / Math.max(1, (totalTicks * zoom) - dims.w)}
                    onChange={(e) => setScrollX(parseFloat(e.target.value) * (totalTicks * zoom - dims.w))}
                    className="flex-1 h-full appearance-none bg-transparent cursor-pointer accent-fuchsia-600" />
                <button onClick={() => setZoom(z => z * 1.2)} className="ml-3 text-gray-500 hover:text-white"><ZoomIn size={14}/></button>
                <button onClick={() => setZoom(z => z * 0.8)} className="ml-2 text-gray-500 hover:text-white"><ZoomOut size={14}/></button>
            </div>
        </div>
    );
};
