
import React from 'react';
import { ChannelKey } from '../types';
import { Check } from 'lucide-react';

interface ChannelSelectorProps {
  selectedChannels: ChannelKey[];
  onChange: (channels: ChannelKey[]) => void;
}

const ALL_CHANNELS: { key: ChannelKey; label: string; group: 'RHYTHM' | 'DRUMS' | 'MELODY' }[] = [
  { key: 'ch1_kick', label: 'Main Kick', group: 'RHYTHM' },
  { key: 'ch2_sub', label: 'Sub Bass', group: 'RHYTHM' },
  { key: 'ch3_midBass', label: 'Baseline (Mid)', group: 'RHYTHM' },
  { key: 'ch8_snare', label: 'Snare', group: 'DRUMS' },
  { key: 'ch9_clap', label: 'Clap', group: 'DRUMS' },
  { key: 'ch12_hhClosed', label: 'Closed HH', group: 'DRUMS' },
  { key: 'ch13_hhOpen', label: 'Open HH', group: 'DRUMS' },
  { key: 'ch10_percLoop', label: 'Percussion A', group: 'DRUMS' },
  { key: 'ch11_percTribal', label: 'Percussion B', group: 'DRUMS' },
  { key: 'ch4_leadA', label: 'Lead A (Hero)', group: 'MELODY' },
  { key: 'ch5_leadB', label: 'Lead B (Support)', group: 'MELODY' },
  { key: 'ch14_acid', label: 'Acid 303', group: 'MELODY' },
  { key: 'ch6_arpA', label: 'Arpeggio A', group: 'MELODY' },
  { key: 'ch7_arpB', label: 'Arpeggio B', group: 'MELODY' },
  { key: 'ch15_pad', label: 'Atmosphere', group: 'MELODY' },
  { key: 'ch16_synth', label: 'Synth FX', group: 'MELODY' },
];

const ChannelSelector: React.FC<ChannelSelectorProps> = ({ selectedChannels, onChange }) => {
  const toggleChannel = (key: ChannelKey) => {
    if (selectedChannels.includes(key)) {
      onChange(selectedChannels.filter(k => k !== key));
    } else {
      onChange([...selectedChannels, key]);
    }
  };

  const renderGroup = (groupName: string, items: typeof ALL_CHANNELS) => (
      <div className="space-y-3">
          <div className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] border-b border-white/5 pb-2">{groupName}</div>
          <div className="grid grid-cols-2 gap-3">
              {items.map(ch => {
                  const isSelected = selectedChannels.includes(ch.key);
                  return (
                    <button
                        key={ch.key}
                        onClick={() => toggleChannel(ch.key)}
                        className={`
                            h-12 rounded-2xl flex items-center px-4 gap-3 transition-all relative overflow-hidden group border
                            ${isSelected 
                                ? 'bg-sky-500/10 border-sky-500/30 text-white shadow-sm' 
                                : 'bg-black/40 border-white/5 text-gray-500 hover:border-white/10 hover:text-gray-400'
                            }
                        `}
                    >
                        <div className={`w-4 h-4 rounded-lg flex items-center justify-center border transition-colors ${isSelected ? 'bg-sky-500 border-sky-500' : 'border-zinc-800'}`}>
                            {isSelected && <Check size={12} className="text-black stroke-[4]" />}
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-tight truncate">{ch.label}</span>
                    </button>
                  );
              })}
          </div>
      </div>
  );

  return (
    <div className="space-y-8">
        <div className="flex gap-3 mb-6">
            <button 
                onClick={() => onChange(ALL_CHANNELS.map(c => c.key))} 
                className="flex-1 text-[10px] font-black uppercase tracking-widest text-white bg-white/5 hover:bg-white/10 transition-all py-3 rounded-xl border border-white/5"
            >
                Select All
            </button>
            <button 
                onClick={() => onChange([])} 
                className="flex-1 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-colors py-3 rounded-xl hover:bg-white/5 border border-white/5"
            >
                Clear All
            </button>
        </div>
        
        <div className="space-y-10 max-h-[450px] overflow-y-auto custom-scrollbar pr-3">
            {renderGroup('The Foundation', ALL_CHANNELS.filter(c => c.group === 'RHYTHM'))}
            {renderGroup('Drums & Percussion', ALL_CHANNELS.filter(c => c.group === 'DRUMS'))}
            {renderGroup('Melodic Elements', ALL_CHANNELS.filter(c => c.group === 'MELODY'))}
        </div>
        
        <div className="pt-4 flex justify-between items-center text-[10px] font-mono text-zinc-600">
            <span>Manifest: <span className="text-sky-500 font-black">{selectedChannels.length}</span> / 16 Channels</span>
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${selectedChannels.length > 0 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-zinc-800'}`}></div>
                <span>Status: {selectedChannels.length > 0 ? 'READY' : 'PENDING'}</span>
            </div>
        </div>
    </div>
  );
};

export default ChannelSelector;
