import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  activeNote: string | null;
  isPlaying: boolean;
  status?: string; 
  isGenerating?: boolean; 
}

const Visualizer: React.FC<VisualizerProps> = ({ activeNote, isPlaying, status, isGenerating }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<{ x: number; y: number; life: number; color: string; vx: number; vy: number }[]>([]);

  useEffect(() => {
    if (activeNote) {
      const noteChar = activeNote.charAt(0);
      let color = '#00F5FF'; // V16.1 Accent
      if (noteChar === 'C') color = '#FFFFFF'; 
      if (noteChar === 'F') color = '#00F5FF'; 
      if (noteChar === 'A') color = '#FF0055'; 

      for (let i = 0; i < 8; i++) {
        particles.current.push({
          x: Math.random() * 300,
          y: Math.random() * 150,
          life: 1.0,
          color: color,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4
        });
      }
    }
  }, [activeNote]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let frame = 0;

    const render = () => {
      frame++;
      ctx.fillStyle = '#000000'; // Pure Black for V16.1 Contrast
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      if (isGenerating) {
          // Tech Scan
          ctx.fillStyle = 'rgba(0, 245, 255, 0.1)';
          const barHeight = Math.sin(frame * 0.1) * 50 + 50;
          ctx.fillRect(0, centerY - barHeight/2, canvas.width, barHeight);
          
          ctx.strokeStyle = '#00F5FF';
          ctx.beginPath();
          ctx.moveTo(0, centerY);
          ctx.lineTo(canvas.width, centerY);
          ctx.stroke();

      } else if (isPlaying) {
        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let x=0; x<canvas.width; x+=20) { ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); }
        ctx.stroke();

        particles.current.forEach((p, index) => {
          p.x += p.vx; p.y += p.vy; p.life -= 0.02;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.random() * 2 + 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
          if (p.life <= 0) particles.current.splice(index, 1);
        });

        if (activeNote) {
            ctx.fillStyle = '#00F5FF';
            ctx.font = 'bold 32px Inter';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#00F5FF';
            ctx.shadowBlur = 20;
            ctx.fillText(activeNote, centerX, centerY);
            ctx.shadowBlur = 0;
        }
      } else {
        // Idle
        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText("SIGNAL WAITING", centerX, centerY);
      }

      animationId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, activeNote, status, isGenerating]);

  return (
    <canvas ref={canvasRef} width={300} height={150} className="w-full h-full object-cover" />
  );
};

export default Visualizer;