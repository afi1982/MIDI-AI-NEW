import React, { useState, useEffect } from 'react';

// Mood Selector Component for V15.1
interface TranceMoodSelectorProps {
    currentMood?: string;
    onMoodChange: (mood: string) => void;
}

const TranceMoodSelector: React.FC<TranceMoodSelectorProps> = ({ currentMood, onMoodChange }) => {
  const [selectedMood, setSelectedMood] = useState(currentMood || 'FullOn');

  useEffect(() => {
    if (currentMood) setSelectedMood(currentMood);
  }, [currentMood]);

  const moods = [
    { id: 'Morning', icon: '🌅', label: 'Morning', desc: 'Lydian Scales & Long Pads' },
    { id: 'Dark', icon: '🌑', label: 'Dark', desc: 'Phrygian Tension & 1/32 Arps' },
    { id: 'Emotional', icon: '🎭', label: 'Emotional', desc: 'Expression (CC11) & Sus Chords' },
    { id: 'FullOn', icon: '⚡', label: 'Full-On', desc: 'Classic Driving Energy' }
  ];

  const handleMoodSelect = (moodId: string) => {
    setSelectedMood(moodId);
    onMoodChange(moodId); // Updates Profile in GenerationParams
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-black/40 rounded-xl border border-white/10 mt-3">
      <label className="text-[10px] uppercase tracking-widest text-cyber-purple font-bold">V15.1 Composition Mood</label>
      {/* Optimized for Sidebar: 2 columns constant */}
      <div className="grid grid-cols-2 gap-2">
        {moods.map((mood) => (
          <button
            key={mood.id}
            onClick={() => handleMoodSelect(mood.id)}
            className={`flex flex-col items-center p-2 rounded-lg border transition-all relative overflow-hidden group ${
              selectedMood === mood.id 
              ? 'bg-purple-600/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
              : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <span className="text-xl mb-1 group-hover:scale-110 transition-transform">{mood.icon}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedMood === mood.id ? 'text-white' : 'text-gray-400'}`}>{mood.label}</span>
            <span className="text-[8px] opacity-50 text-center leading-tight mt-1 hidden md:block">{mood.desc}</span>
            
            {selectedMood === mood.id && <div className="absolute inset-0 bg-purple-500/10 animate-pulse pointer-events-none"></div>}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TranceMoodSelector;