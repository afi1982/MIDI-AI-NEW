import React, { useMemo, useState, useEffect, useRef } from 'react';
import { GrooveObject, ChannelKey, NoteEvent, ReferenceProfileStats } from '../types';
import { ELITE_16_CHANNELS } from '../services/maestroService';
import { engineProfileService } from '../services/engineProfileService';
import { downloadFullArrangementMidi } from '../services/midiService';
import { ArrowLeft, Download, Activity, AlertTriangle, CheckCircle, Search, Layers, Ruler, FileAudio, ChevronDown, ChevronUp } from 'lucide-react';

interface TrackAnalyzerPageProps {
    groove: GrooveObject;
    onClose: () => void;
}

const TICKS_PER_BAR = 1920; 

interface ChannelStat {
    key: ChannelKey;
    noteCount: number;
    activeRanges: { start: number; end: number }[];
    density: number; 
}

interface ForensicMetrics {
    totalBars: number;
    zeroTickCompliant: boolean;
    leadNoteCount: number;
    leadVelocityVariance: string;
    leadScarcityAvg: number; 
    dominantOverlapWarnings: number[]; 
    conductorIntent: { bar: number; intent: 'STATEMENT' | 'REST' }[];
    emptyChannels: ChannelKey[];
}

export const TrackAnalyzerPage: React.FC<TrackAnalyzerPageProps> = ({ groove, onClose }) => {
    const [metrics, setMetrics] = useState<ForensicMetrics | null>(null);
    const [channelStats, setChannelStats] = useState<ChannelStat[]>([]);
    const [hardError, setHardError] = useState<string | null>(null);
    const [isManifestOpen, setIsManifestOpen] = useState(false); 
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const parseTick = (t: string) => {
        if (!t || typeof t !== 'string') return 0;
        const p = t.split(':').map(Number);
        return (p[0] * 1920) + (p[1] * 480) + (p[2] * 120);
    };

    const hasNotesInWindow = (notes: any[], start: number, end: number) => {
        if (!notes || !Array.isArray(notes)) return false;
        return notes.some(n => {
            const t = parseTick(n.time);
            return t >= start && t < end;
        });
    };

    useEffect(() => {
        if (!groove) return;

        let totalGlobalNotes = 0;
        const stats: ChannelStat[] = [];
        const eliteKeys = ELITE_16_CHANNELS;

        eliteKeys.forEach(key => {
            const notes = (groove as any)[key] as NoteEvent[] || [];
            totalGlobalNotes += notes.length;
            stats.push({
                key,
                noteCount: notes.length,
                activeRanges: [],
                density: notes.length / (groove.totalBars || 1)
            });
        });

        if (totalGlobalNotes === 0) {
            setHardError("EMPTY MIDI: No musical events found in the current project.");
            return;
        }

        const leadNotes = (groove.ch4_leadA || []) as NoteEvent[];
        let zeroTick = true;
        eliteKeys.forEach(k => {
            const n = (groove as any)[k] as NoteEvent[];
            if (n && n.some(x => x.timingOffset !== 0)) zeroTick = false;
        });

        let velVar = "0%";
        if (leadNotes.length > 0) {
            const vels = leadNotes.map(n => n.velocity);
            const min = Math.min(...vels);
            const max = Math.max(...vels);
            velVar = `${((max - min) * 100).toFixed(1)}%`;
        }

        let scarcitySum = 0;
        let gaps = 0;
        if (leadNotes.length > 1) {
            const sorted = [...leadNotes].sort((a,b) => parseTick(a.time) - parseTick(b.time));
            for(let i=1; i<sorted.length; i++) {
                const prevEnd = parseTick(sorted[i-1].time) + (sorted[i-1].durationTicks || 120);
                const currStart = parseTick(sorted[i].time);
                const diffBars = (currStart - prevEnd) / TICKS_PER_BAR;
                if (diffBars > 2) { 
                    scarcitySum += diffBars;
                    gaps++;
                }
            }
        }
        const scarcity = gaps > 0 ? (scarcitySum / gaps) : 0;

        const overlapBars: number[] = [];
        const totalBars = groove.totalBars || 64;
        for(let b=0; b<totalBars; b+=4) {
            const startTick = b * TICKS_PER_BAR;
            const endTick = (b + 4) * TICKS_PER_BAR;
            if (hasNotesInWindow(groove.ch4_leadA, startTick, endTick) && 
                hasNotesInWindow(groove.ch14_acid, startTick, endTick) && 
                hasNotesInWindow(groove.ch6_arpA, startTick, endTick)) {
                overlapBars.push(b);
            }
        }

        const intents: { bar: number; intent: 'STATEMENT' | 'REST' }[] = [];
        for(let b=0; b<totalBars; b+=8) {
            intents.push({ bar: b, intent: hasNotesInWindow(groove.ch4_leadA, b * TICKS_PER_BAR, (b+8)*TICKS_PER_BAR) ? 'STATEMENT' : 'REST' });
        }

        setMetrics({
            totalBars,
            zeroTickCompliant: zeroTick,
            leadNoteCount: leadNotes.length,
            leadVelocityVariance: velVar,
            leadScarcityAvg: parseFloat(scarcity.toFixed(1)),
            dominantOverlapWarnings: overlapBars,
            conductorIntent: intents,
            emptyChannels: stats.filter(s => s.noteCount === 0).map(s => s.key)
        });
        setChannelStats(stats);
    }, [groove]);

    if (hardError) {
        return (
            <div className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-center p-8 text-center">
                <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-black text-white mb-2">ENGINE ERROR</h1>
                <p className="text-gray-400 max-w-md mb-8">{hardError}</p>
                <button onClick={onClose} className="px-8 py-3 bg-white text-black font-bold uppercase rounded-lg">Return to Base</button>
            </div>
        );
    }

    if (!metrics) return <div className="fixed inset-0 bg-black z-[500] flex items-center justify-center text-sky-400 font-mono">CALCULATING FORENSICS...</div>;

    const PIXELS_PER_BAR = 60; 
    const TOTAL_WIDTH = Math.max(1000, (metrics.totalBars * PIXELS_PER_BAR) + 100);

    return (
        <div className="fixed inset-0 z-[400] bg-[#050505] text-white flex flex-col font-sans overflow-hidden">
            <div className="h-14 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-white"><ArrowLeft size={18} /></button>
                    <div className="flex flex-col">
                        <h1 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                            <Activity size={14} className="text-sky-400" />
                            Spectral <span className="text-sky-400">Forensics</span>
                        </h1>
                        <p className="text-[8px] text-gray-600 font-mono">V90 PIPELINE AUDIT</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => downloadFullArrangementMidi(groove)} className="flex items-center gap-2 px-3 py-1.5 bg-sky-500 text-black rounded text-[10px] font-bold uppercase hover:bg-sky-400">MIDI</button>
                    <button onClick={onClose} className="px-3 py-1.5 border border-white/10 text-gray-500 hover:text-white rounded text-[10px] font-bold uppercase">Exit</button>
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                <div className="w-full md:w-64 bg-[#0E0E10] border-r border-white/5 flex flex-col shrink-0">
                    <div className="p-3 border-b border-white/5 bg-black/40">
                         <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Manifest</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {channelStats.map(stat => (
                            <div key={stat.key} className="px-4 py-2.5 border-b border-white/5 flex justify-between items-center hover:bg-white/5 transition-colors">
                                <div className="min-w-0">
                                    <div className={`text-[9px] font-bold uppercase truncate ${stat.noteCount > 0 ? 'text-gray-300' : 'text-gray-600'}`}>{stat.key.replace(/ch\d+_/, '')}</div>
                                    <div className="text-[7px] text-gray-600 font-mono uppercase">{stat.key.split('_')[0]}</div>
                                </div>
                                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${stat.noteCount > 0 ? 'bg-green-900/20 text-green-400' : 'bg-red-900/10 text-red-500'}`}>
                                    {stat.noteCount > 0 ? `${stat.noteCount} ev` : '0'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0 bg-[#080808]">
                    <div className="shrink-0 border-b border-white/10 bg-[#0C0C0E] grid grid-cols-2 md:grid-cols-4 gap-px p-3">
                        <div className="p-3 bg-black/20 rounded border border-white/5">
                            <div className="text-[8px] text-gray-500 font-bold uppercase mb-1">Timing Grid</div>
                            <div className="text-lg font-black text-white">{metrics.totalBars} Bars</div>
                            <div className="text-[8px] text-sky-400 font-mono mt-1">SYNCCheck: {metrics.zeroTickCompliant ? 'PASSED' : 'DRIFT'}</div>
                        </div>
                        <div className="p-3 bg-black/20 rounded border border-white/5">
                            <div className="text-[8px] text-gray-500 font-bold uppercase mb-1">Lead Dynamics</div>
                            <div className="text-lg font-black text-sky-400">{metrics.leadVelocityVariance}</div>
                            <div className="text-[8px] text-gray-500 font-mono mt-1">{metrics.leadNoteCount} Engine Events</div>
                        </div>
                        <div className="p-3 bg-black/20 rounded border border-white/5">
                            <div className="text-[8px] text-gray-500 font-bold uppercase mb-1">Phasing</div>
                            <div className="text-lg font-black text-white">{metrics.leadScarcityAvg}b</div>
                            <div className="text-[8px] text-gray-500 font-mono mt-1">Avg Scarcity Interval</div>
                        </div>
                        <div className="p-3 bg-black/20 rounded border border-white/5">
                            <div className="text-[8px] text-gray-500 font-bold uppercase mb-1">Health</div>
                            <div className="flex items-center gap-2 mt-1">
                                <div className={`w-2 h-2 rounded-full ${metrics.dominantOverlapWarnings.length > 0 ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></div>
                                <span className="text-[10px] font-bold">{metrics.dominantOverlapWarnings.length > 0 ? 'OVERLAP ALERT' : 'OPTIMIZED'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto relative custom-scrollbar bg-[#121214]" ref={scrollContainerRef}>
                        <div style={{ width: TOTAL_WIDTH }} className="relative min-h-full">
                            <div className="h-6 bg-[#1A1A1D] border-b border-white/10 flex items-end sticky top-0 z-20">
                                {Array.from({ length: metrics.totalBars }).map((_, i) => (
                                    <div key={i} className="border-r border-white/5 text-[8px] text-gray-600 pl-1 pb-0.5 font-mono shrink-0" style={{ width: PIXELS_PER_BAR }}>
                                        {i % 4 === 0 ? i : ''}
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col w-full">
                                {ELITE_16_CHANNELS.map((key) => {
                                    const notes = (groove as any)[key] as NoteEvent[] || [];
                                    return (
                                        <div key={key} className="h-10 border-b border-white/5 relative w-full group hover:bg-white/[0.02]">
                                            <div className="absolute left-2 top-2.5 text-[8px] font-black uppercase text-white/5 pointer-events-none group-hover:text-white/20 transition-colors z-30">
                                                {key.replace(/ch\d+_/, '')}
                                            </div>
                                            {notes.map((n, nIdx) => {
                                                const startTick = parseTick(n.time);
                                                const startPx = (startTick / TICKS_PER_BAR) * PIXELS_PER_BAR;
                                                const widthPx = Math.max(3, ((n.durationTicks || 120) / TICKS_PER_BAR) * PIXELS_PER_BAR);
                                                return (
                                                    <div 
                                                        key={nIdx}
                                                        // FIX: Used standard tailwind color instead of undefined bg-studio-accent
                                                        className="absolute top-1.5 bottom-1.5 rounded-[1px] bg-sky-500/60 border-l border-white/30 hover:bg-sky-400"
                                                        style={{ left: startPx, width: widthPx }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};