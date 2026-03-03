
import React from 'react';
import { STYLE_PROFILES, StyleProfileKey, StyleProfile } from '../services/profileService';
import { Check } from 'lucide-react';

interface GenreSelectorProps {
    currentProfileId: StyleProfileKey;
    onProfileChange: (id: StyleProfileKey) => void;
    label?: string;
}

const GenreSelector: React.FC<GenreSelectorProps> = ({ currentProfileId, onProfileChange, label }) => {
    const profiles = Object.values(STYLE_PROFILES) as StyleProfile[];

    return (
        <div className="flex flex-col gap-3 flex-1">
            {label && (
                <label className="text-[10px] uppercase font-bold text-studio-dim tracking-wider flex items-center gap-2">
                    <span className="w-1 h-3 bg-studio-primary rounded-sm"></span>
                    {label}
                </label>
            )}
            <div className="grid grid-cols-1 gap-2">
                {profiles.map((p) => {
                    const isActive = currentProfileId === p.id;
                    return (
                        <button
                            key={p.id}
                            onClick={() => onProfileChange(p.id)}
                            className={`
                                group relative flex items-center justify-between px-4 py-3 rounded-md border transition-all duration-200
                                ${isActive 
                                    ? 'bg-studio-primary/10 border-studio-primary text-white shadow-glow' 
                                    : 'bg-studio-panel/50 border-studio-border/50 text-studio-dim hover:border-studio-border hover:bg-studio-panel'
                                }
                            `}
                        >
                            <div className="flex flex-col items-start">
                                <span className={`text-xs font-bold uppercase tracking-tight transition-colors ${isActive ? 'text-white' : 'group-hover:text-gray-200'}`}>
                                    {p.label}
                                </span>
                                <span className="text-[9px] font-mono opacity-60 mt-0.5">
                                    {p.blueprint.tempo.default} BPM
                                </span>
                            </div>
                            
                            <div className={`
                                w-4 h-4 rounded-full border flex items-center justify-center transition-all
                                ${isActive ? 'bg-studio-primary border-studio-primary' : 'border-studio-dim/30'}
                            `}>
                                {isActive && <Check size={10} className="text-white" strokeWidth={4} />}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default GenreSelector;
