
import React, { useState } from 'react';
import { FxConfig, FxType } from '../types';

interface FxRackProps {
  channelName: string;
  fxChain: FxConfig[];
  onChainUpdate: (newChain: FxConfig[]) => void;
  availableChannels: string[];
  onChannelSelect: (channel: string) => void;
}

const FX_TYPES: FxType[] = ['DISTORTION', 'DELAY', 'REVERB', 'CHORUS', 'FILTER', 'BITCRUSHER', 'EQ3'];

const FxKnob: React.FC<{ label: string, value: number, min: number, max: number, onChange: (v: number) => void }> = ({ label, value, min, max, onChange }) => {
    // Clamp display value
    const clampedValue = Math.min(max, Math.max(min, value || min));
    
    // Wrap onChange to enforce clamp on update
    const handleChange = (newVal: number) => {
        const safeVal = Math.min(max, Math.max(min, newVal));
        onChange(safeVal);
    };
    
    return (
        <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 bg-black flex items-center justify-center relative overflow-hidden group hover:border-studio-accent/50">
                <div className="absolute inset-0 bg-white/5"></div>
                <input 
                    type="range" min={min} max={max} step={0.01} value={clampedValue} 
                    onChange={e => handleChange(Number(e.target.value))}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                />
                {/* Visual Indicator */}
                <div className="w-0.5 h-3 bg-studio-accent origin-bottom absolute bottom-1/2 left-1/2 -translate-x-1/2 pointer-events-none" 
                     style={{ transform: `translateX(-50%) rotate(${((clampedValue - min) / (max - min)) * 270 - 135}deg)` }} />
            </div>
            <span className="text-[7px] uppercase mt-1 text-gray-500 font-bold">{label}</span>
        </div>
    );
};

const FxUnit: React.FC<{ config: FxConfig, onUpdate: (c: FxConfig) => void, onRemove: () => void }> = ({ config, onUpdate, onRemove }) => {
    const set = (k: string, v: number) => onUpdate({ ...config, settings: { ...config.settings, [k]: v } });
    
    return (
        <div className="w-32 h-40 shrink-0 bg-[#121218] border border-white/10 rounded-lg flex flex-col shadow-lg relative overflow-hidden">
            {/* Header */}
            <div className={`h-6 flex justify-between items-center px-2 ${config.enabled ? 'bg-studio-accent/10' : 'bg-gray-800/50'}`}>
                <span className={`text-[9px] font-bold uppercase tracking-widest ${config.enabled ? 'text-studio-accent' : 'text-gray-500'}`}>{config.type}</span>
                <button onClick={onRemove} className="text-gray-600 hover:text-red-500 text-xs font-bold">×</button>
            </div>
            
            {/* Bypass Switch */}
            <div className="absolute top-8 right-2">
                <button onClick={() => onUpdate({...config, enabled: !config.enabled})} className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-studio-accent shadow-[0_0_5px_rgba(0,245,255,0.5)]' : 'bg-red-900'}`} />
            </div>

            {/* Controls */}
            <div className={`flex-1 p-2 grid grid-cols-2 gap-2 content-center ${!config.enabled ? 'opacity-30 grayscale' : ''}`}>
                {config.type === 'DISTORTION' && <FxKnob label="Drive" min={0} max={1} value={config.settings.distortion} onChange={v => set('distortion', v)} />}
                {config.type === 'DELAY' && <>
                    <FxKnob label="Time" min={0} max={1} value={0.5} onChange={() => {}} />
                    <FxKnob label="Fdbk" min={0} max={0.9} value={config.settings.feedback} onChange={v => set('feedback', v)} />
                </>}
                {config.type === 'REVERB' && <>
                    {/* Fixed: Range is strictly [0.5, 8] to prevent Tone.js crashes */}
                    <FxKnob label="Decay" min={0.5} max={8} value={config.settings.decay || 1.5} onChange={v => set('decay', v)} />
                    <FxKnob label="Mix" min={0} max={1} value={config.settings.wet || 0.5} onChange={v => set('wet', v)} />
                </>}
                {config.type === 'FILTER' && <FxKnob label="Freq" min={50} max={5000} value={config.settings.frequency} onChange={v => set('frequency', v)} />}
            </div>
        </div>
    );
};

const FxRack: React.FC<FxRackProps> = ({ channelName, fxChain, onChainUpdate, availableChannels, onChannelSelect }) => {
    const [showAdd, setShowAdd] = useState(false);

    return (
        <div className="h-full flex flex-col">
            {/* Channel Selector */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-3 pb-1">
                {availableChannels.map(ch => (
                    <button 
                        key={ch} 
                        onClick={() => onChannelSelect(ch)}
                        className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap ${channelName === ch ? 'bg-studio-accent text-black border-studio-accent' : 'bg-transparent text-gray-500 border-white/10'}`}
                    >
                        {ch}
                    </button>
                ))}
            </div>

            {/* Rack */}
            <div className="flex-1 flex gap-3 items-center overflow-x-auto hide-scrollbar">
                {fxChain.map((fx, i) => (
                    <FxUnit 
                        key={fx.id} 
                        config={fx} 
                        onUpdate={c => { const n = [...fxChain]; n[i] = c; onChainUpdate(n); }} 
                        onRemove={() => { const n = [...fxChain]; n.splice(i, 1); onChainUpdate(n); }} 
                    />
                ))}
                
                {/* Add Button */}
                <button 
                    onClick={() => setShowAdd(!showAdd)}
                    className="w-16 h-32 shrink-0 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center text-gray-600 hover:text-studio-accent hover:border-studio-accent transition-colors"
                >
                    <span className="text-2xl font-light">+</span>
                </button>
            </div>

            {/* Add Drawer */}
            {showAdd && (
                <div className="mt-3 grid grid-cols-4 gap-2 animate-in slide-in-from-top-2 fade-in">
                    {FX_TYPES.map(t => (
                        <button 
                            key={t}
                            onClick={() => {
                                onChainUpdate([...fxChain, { 
                                    id: Date.now().toString(), 
                                    type: t, 
                                    enabled: true, 
                                    settings: { wet: 0.5, decay: 1.5, distortion: 0.2, feedback: 0.3, frequency: 1000 } 
                                }]);
                                setShowAdd(false);
                            }}
                            className="bg-white/5 border border-white/10 rounded py-2 text-[8px] font-bold hover:bg-studio-accent hover:text-black transition-colors"
                        >
                            {t}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FxRack;
