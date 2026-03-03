

import React, { useEffect, useRef } from 'react';
import { NoteEvent, ChannelKey } from '../types';
import * as Tone from 'tone';

interface MidiVisualizerProps {
  groove: any;
  isPlaying: boolean;
}

const TRACK_COLORS: Record<string, string> = {
    'ch1_kick': '#E04E4E', 'ch2_sub': '#F2A044', 'ch3_midBass': '#EBC144',
    'ch4_leadA': '#4487F2', 'ch5_leadB': '#5A9CF2', 'ch6_arpA': '#D944F2',
    'ch7_arpB': '#A344F2', 'ch8_snare': '#44F27B', 'ch9_clap': '#44F244',
    'ch10_percLoop': '#44F2DB', 'ch11_percTribal': '#44DBF2', 'ch12_hhClosed': '#9BF244',
    'ch13_hhOpen': '#B8F244', 'ch14_acid': '#F244A3', 'ch15_pad': '#6644F2', 'ch16_synth': '#F244E0'
};

const NOTE_TO_MIDI: Record<string, number> = { "C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11 };

function getNotePitch(note: string | string[]): number {
    const s = Array.isArray(note) ? note[0] : note;
    if (!s) return 60;
    const match = s.match(/([A-G]#?)(-?\d+)/);
    if (!match) return 60;
    const name = match[1];
    const octave = parseInt(match[2]);
    return (octave + 1) * 12 + (NOTE_TO_MIDI[name] || 0);
}

export const MidiVisualizer: React.FC<MidiVisualizerProps> = ({ groove, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      if (!canvas || !ctx || !groove) return;
      
      const w = canvas.width;
      const h = canvas.height;
      const bpm = Tone.Transport.bpm.value; 
      const now = Tone.Transport.seconds;
      
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);

      const viewWindowSeconds = 4; 
      const pixelsPerSecond = w / viewWindowSeconds;
      const offsetX = -now * pixelsPerSecond + (w * 0.2); 

      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      for(let i=0; i<h; i+=h/12) {
          ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      const startBeat = Math.floor((now - 1) * (bpm/60));
      const endBeat = Math.ceil((now + viewWindowSeconds + 1) * (bpm/60));
      
      for (let i = startBeat; i < endBeat; i++) {
          const beatTime = i * (60 / bpm);
          const x = (beatTime * pixelsPerSecond) + offsetX;
          if (x > 0 && x < w) {
              ctx.beginPath();
              ctx.moveTo(x, 0); ctx.lineTo(x, h);
              ctx.stroke();
          }
      }

      ctx.strokeStyle = '#00FF41';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, 0); ctx.lineTo(w * 0.2, h);
      ctx.stroke();

      const eliteChannels = Object.keys(TRACK_COLORS);
      eliteChannels.forEach(ch => {
          const notes = (groove as any)[ch] as NoteEvent[];
          if (!notes || !Array.isArray(notes)) return;

          ctx.fillStyle = TRACK_COLORS[ch];
          const noteHeight = h / 64; 

          notes.forEach(note => {
              const startTick = note.startTick || 0;
              const startTime = (startTick / 480) * (60 / groove.bpm); 
              const durationTicks = note.durationTicks || 120;
              const durationTime = (durationTicks / 480) * (60 / groove.bpm);
              
              const x = (startTime * pixelsPerSecond) + offsetX;
              const width = Math.max(3, durationTime * pixelsPerSecond);
              
              if (x + width > 0 && x < w) {
                  const pitch = getNotePitch(note.note);
                  const y = h - ((pitch - 24) * noteHeight); 
                  
                  ctx.globalAlpha = 0.9;
                  ctx.fillRect(x, y, width, noteHeight - 1);
                  ctx.globalAlpha = 1.0;
              }
          });
      });

      animationFrameId = requestAnimationFrame(render);
    };

    const handleResize = () => {
        if (containerRef.current && canvasRef.current) {
            canvasRef.current.width = containerRef.current.offsetWidth * window.devicePixelRatio;
            canvasRef.current.height = containerRef.current.offsetHeight * window.devicePixelRatio;
        }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [groove]);

  return (
    <div ref={containerRef} className="w-full h-full bg-black relative">
       <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
