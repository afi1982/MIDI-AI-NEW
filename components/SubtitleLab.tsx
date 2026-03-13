import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  ArrowLeft,
  Download,
  FileText,
  Languages,
  Loader2,
  Palette,
  Pause,
  Play,
  Plus,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2
} from 'lucide-react';
import type { SubtitleCue, SubtitleStyle } from '../types';
import {
  transcribeAndTranslateMedia,
  translateSubtitleCues,
  subtitlesToSrt,
  subtitlesToVtt,
  downloadSubtitleFile,
  normalizeSubtitleCues
} from '../services/subtitleService';

interface SubtitleLabProps {
  onClose: () => void;
}

const LANGUAGES = [
  'Auto detect',
  'English',
  'Hebrew',
  'Arabic',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Russian',
  'Ukrainian',
  'Turkish',
  'Hindi',
  'Japanese',
  'Korean',
  'Chinese (Simplified)',
  'Chinese (Traditional)',
  'Thai',
  'Vietnamese',
  'Indonesian',
  'Malay'
];

const DEFAULT_STYLE: SubtitleStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 38,
  textColor: '#ffffff',
  backgroundColor: 'rgba(0,0,0,0.45)',
  outlineColor: '#000000',
  outlineSize: 2,
  bold: true,
  italic: false,
  uppercase: false,
  shadow: true,
  letterSpacing: 0.3,
  maxWidthPercent: 82,
  position: 'BOTTOM',
  animation: 'POP'
};

const STYLE_PRESETS: Array<{ id: string; name: string; style: Partial<SubtitleStyle> }> = [
  {
    id: 'tiktok-clean',
    name: 'TikTok Clean',
    style: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 40,
      textColor: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.45)',
      outlineColor: '#000000',
      outlineSize: 2,
      bold: true,
      shadow: true,
      position: 'BOTTOM',
      animation: 'POP'
    }
  },
  {
    id: 'neon',
    name: 'Neon Glow',
    style: {
      textColor: '#34d399',
      backgroundColor: 'rgba(0,0,0,0.25)',
      outlineColor: '#052e2b',
      outlineSize: 1,
      shadow: true,
      animation: 'GLOW'
    }
  },
  {
    id: 'bold-center',
    name: 'Center Punch',
    style: {
      fontSize: 46,
      textColor: '#fef08a',
      backgroundColor: 'rgba(0,0,0,0.55)',
      outlineColor: '#000000',
      outlineSize: 2,
      position: 'CENTER',
      animation: 'SLIDE'
    }
  }
];

const makeCue = (startSec: number): SubtitleCue => ({
  id: `cue-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
  startSec,
  endSec: startSec + 2,
  text: '',
  translatedText: '',
  speaker: ''
});

const formatPreviewTime = (sec: number) => {
  const safe = Math.max(0, sec || 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.floor((safe - Math.floor(safe)) * 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};

export const SubtitleLab: React.FC<SubtitleLabProps> = ({ onClose }) => {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);

  const [sourceLanguage, setSourceLanguage] = useState('Auto detect');
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [customTargetLanguage, setCustomTargetLanguage] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState('—');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');

  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [displayMode, setDisplayMode] = useState<'TRANSLATED' | 'ORIGINAL'>('TRANSLATED');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const mediaRef = useRef<HTMLMediaElement | null>(null);

  const resolvedTargetLanguage = customTargetLanguage.trim() || targetLanguage;

  const activeCue = useMemo(() => {
    return cues.find(cue => currentTime >= cue.startSec && currentTime <= cue.endSec) || null;
  }, [cues, currentTime]);

  const onDrop = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];

    if (mediaUrl) URL.revokeObjectURL(mediaUrl);

    const url = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaUrl(url);
    setIsVideo(file.type.startsWith('video/'));
    setDetectedLanguage('—');
    setSummary('');
    setError('');
    setProgress(0);
    setCues([]);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [mediaUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'],
      'video/*': ['.mp4', '.mov', '.mkv', '.webm', '.m4v']
    }
  } as any);

  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    };
  }, [mediaUrl]);

  const handleTranscribe = async () => {
    if (!mediaFile) return;
    setError('');
    setSummary('');
    setIsProcessing(true);
    setProgress(0);
    try {
      const result = await transcribeAndTranslateMedia(
        mediaFile,
        { sourceLanguage, targetLanguage: resolvedTargetLanguage },
        setProgress
      );
      setDetectedLanguage(result.detectedLanguage);
      setSummary(result.summary || '');
      setCues(normalizeSubtitleCues(result.cues));
      setDisplayMode('TRANSLATED');
    } catch (err: any) {
      setError(err?.message || 'Transcription failed. Try a shorter file or another format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetranslate = async () => {
    if (cues.length === 0) return;
    setError('');
    setIsTranslating(true);
    try {
      const translated = await translateSubtitleCues(cues, resolvedTargetLanguage, sourceLanguage);
      setCues(normalizeSubtitleCues(translated));
      setDisplayMode('TRANSLATED');
    } catch (err: any) {
      setError(err?.message || 'Translation failed.');
    } finally {
      setIsTranslating(false);
    }
  };

  const patchCue = (cueId: string, patch: Partial<SubtitleCue>) => {
    setCues(prev => normalizeSubtitleCues(prev.map(cue => cue.id === cueId ? { ...cue, ...patch } : cue)));
  };

  const removeCue = (cueId: string) => {
    setCues(prev => prev.filter(cue => cue.id !== cueId));
  };

  const addCueAtCurrentTime = () => {
    const cue = makeCue(currentTime);
    setCues(prev => normalizeSubtitleCues([...prev, cue]));
  };

  const applyPreset = (presetId: string) => {
    const preset = STYLE_PRESETS.find(item => item.id === presetId);
    if (!preset) return;
    setStyle(prev => ({ ...prev, ...preset.style }));
  };

  const syncCurrentTime = () => {
    if (!mediaRef.current) return;
    setCurrentTime(mediaRef.current.currentTime || 0);
  };

  const seekTo = (sec: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = Math.max(0, sec);
    setCurrentTime(Math.max(0, sec));
  };

  const togglePlayback = async () => {
    if (!mediaRef.current) return;
    if (mediaRef.current.paused) {
      await mediaRef.current.play();
      setIsPlaying(true);
      return;
    }
    mediaRef.current.pause();
    setIsPlaying(false);
  };

  const activeText = activeCue
    ? (displayMode === 'TRANSLATED' ? (activeCue.translatedText || activeCue.text) : activeCue.text)
    : '';

  const overlayPositionClass =
    style.position === 'TOP'
      ? 'top-5'
      : style.position === 'CENTER'
        ? 'top-1/2 -translate-y-1/2'
        : 'bottom-5';

  const overlayAnimationClass =
    style.animation === 'NONE'
      ? ''
      : style.animation === 'SLIDE'
        ? 'animate-bounce'
        : 'animate-pulse';

  const baseName = (mediaFile?.name || 'subtitles').replace(/\.[^/.]+$/, '');

  const exportSrt = () => {
    const content = subtitlesToSrt(cues, displayMode === 'TRANSLATED');
    downloadSubtitleFile(content, `${baseName}.${displayMode === 'TRANSLATED' ? resolvedTargetLanguage : 'source'}.srt`, 'text/plain;charset=utf-8');
  };

  const exportVtt = () => {
    const content = subtitlesToVtt(cues, displayMode === 'TRANSLATED');
    downloadSubtitleFile(content, `${baseName}.${displayMode === 'TRANSLATED' ? resolvedTargetLanguage : 'source'}.vtt`, 'text/vtt;charset=utf-8');
  };

  const exportJson = () => {
    const payload = {
      sourceFile: mediaFile?.name,
      sourceLanguage,
      detectedLanguage,
      targetLanguage: resolvedTargetLanguage,
      style,
      cues
    };
    downloadSubtitleFile(JSON.stringify(payload, null, 2), `${baseName}.subtitle-project.json`, 'application/json;charset=utf-8');
  };

  return (
    <div className="h-full bg-[#050508] text-white flex flex-col">
      <header className="h-20 border-b border-white/10 bg-[#0A0A0B] px-6 md:px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black uppercase italic tracking-tight">
              Subtitle <span className="text-cyan-400">Lab</span>
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">
              Multilingual Transcribe • Translate • Style
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportSrt}
            disabled={cues.length === 0}
            className="px-3 py-2 text-xs rounded-lg border border-white/15 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download size={14} /> SRT
          </button>
          <button
            onClick={exportVtt}
            disabled={cues.length === 0}
            className="px-3 py-2 text-xs rounded-lg border border-white/15 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download size={14} /> VTT
          </button>
          <button
            onClick={exportJson}
            disabled={cues.length === 0}
            className="px-3 py-2 text-xs rounded-lg bg-cyan-500 text-black font-bold hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FileText size={14} /> Project
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[340px_1fr_420px] gap-0 overflow-hidden">
        <aside className="border-r border-white/10 bg-[#08080B] p-4 md:p-5 overflow-y-auto custom-scrollbar space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-3xl p-6 cursor-pointer transition-all ${
              isDragActive ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/15 hover:border-white/30'
            }`}
          >
            <input {...getInputProps()} />
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mb-4">
              <UploadCloud size={28} className="text-cyan-300" />
            </div>
            <h3 className="font-black uppercase tracking-tight text-lg">Upload media</h3>
            <p className="text-xs text-gray-500 mt-2">
              Drop video/audio file for speech-to-text subtitles.
            </p>
            {mediaFile && <p className="text-[11px] text-cyan-300 mt-3 break-all">{mediaFile.name}</p>}
          </div>

          <div className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Languages size={15} className="text-cyan-300" />
              Languages
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Source</label>
              <select
                value={sourceLanguage}
                onChange={e => setSourceLanguage(e.target.value)}
                className="w-full bg-black/40 rounded-xl border border-white/10 px-3 py-2 text-sm outline-none"
              >
                {LANGUAGES.map(lang => <option key={`source-${lang}`} value={lang}>{lang}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Target</label>
              <select
                value={targetLanguage}
                onChange={e => setTargetLanguage(e.target.value)}
                className="w-full bg-black/40 rounded-xl border border-white/10 px-3 py-2 text-sm outline-none"
              >
                {LANGUAGES.filter(lang => lang !== 'Auto detect').map(lang => (
                  <option key={`target-${lang}`} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Custom target (any language)</label>
              <input
                value={customTargetLanguage}
                onChange={e => setCustomTargetLanguage(e.target.value)}
                placeholder="e.g. Swahili / Filipino / Persian / Greek"
                className="w-full bg-black/40 rounded-xl border border-white/10 px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleTranscribe}
              disabled={!mediaFile || isProcessing}
              className="px-3 py-2 rounded-xl bg-cyan-500 text-black font-black text-xs uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {isProcessing ? `${progress}%` : 'Transcribe'}
            </button>
            <button
              onClick={handleRetranslate}
              disabled={cues.length === 0 || isTranslating}
              className="px-3 py-2 rounded-xl border border-white/15 text-xs uppercase font-bold hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
              Translate
            </button>
          </div>

          <div className="bg-white/5 rounded-2xl border border-white/10 p-4 text-xs space-y-1">
            <div>Detected language: <span className="text-cyan-300 font-bold">{detectedLanguage}</span></div>
            <div>Target language: <span className="text-cyan-300 font-bold">{resolvedTargetLanguage}</span></div>
            <div>Cues: <span className="text-cyan-300 font-bold">{cues.length}</span></div>
            {summary && <p className="text-gray-400 pt-2 leading-relaxed">{summary}</p>}
            {error && <p className="text-red-400 pt-2">{error}</p>}
          </div>

          <div className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Palette size={15} className="text-fuchsia-300" />
              TikTok style
            </div>
            <div className="grid grid-cols-3 gap-2">
              {STYLE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className="text-[10px] px-2 py-1.5 rounded-lg border border-white/15 hover:bg-white/10"
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] uppercase text-gray-500 font-bold">
                Font size
                <input
                  type="range"
                  min={22}
                  max={72}
                  value={style.fontSize}
                  onChange={e => setStyle(prev => ({ ...prev, fontSize: Number(e.target.value) }))}
                  className="w-full mt-1"
                />
              </label>
              <label className="text-[10px] uppercase text-gray-500 font-bold">
                Outline
                <input
                  type="range"
                  min={0}
                  max={6}
                  value={style.outlineSize}
                  onChange={e => setStyle(prev => ({ ...prev, outlineSize: Number(e.target.value) }))}
                  className="w-full mt-1"
                />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-[10px] uppercase text-gray-500 font-bold">Text
                <input
                  type="color"
                  value={style.textColor}
                  onChange={e => setStyle(prev => ({ ...prev, textColor: e.target.value }))}
                  className="w-full h-8 bg-transparent border border-white/10 rounded mt-1"
                />
              </label>
              <label className="text-[10px] uppercase text-gray-500 font-bold">BG
                <input
                  type="color"
                  value={style.backgroundColor.startsWith('#') ? style.backgroundColor : '#000000'}
                  onChange={e => setStyle(prev => ({ ...prev, backgroundColor: e.target.value }))}
                  className="w-full h-8 bg-transparent border border-white/10 rounded mt-1"
                />
              </label>
              <label className="text-[10px] uppercase text-gray-500 font-bold">Outline
                <input
                  type="color"
                  value={style.outlineColor}
                  onChange={e => setStyle(prev => ({ ...prev, outlineColor: e.target.value }))}
                  className="w-full h-8 bg-transparent border border-white/10 rounded mt-1"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={style.position}
                onChange={e => setStyle(prev => ({ ...prev, position: e.target.value as SubtitleStyle['position'] }))}
                className="bg-black/40 rounded-xl border border-white/10 px-2 py-2 text-xs outline-none"
              >
                <option value="TOP">Top</option>
                <option value="CENTER">Center</option>
                <option value="BOTTOM">Bottom</option>
              </select>
              <select
                value={style.animation}
                onChange={e => setStyle(prev => ({ ...prev, animation: e.target.value as SubtitleStyle['animation'] }))}
                className="bg-black/40 rounded-xl border border-white/10 px-2 py-2 text-xs outline-none"
              >
                <option value="NONE">No Animation</option>
                <option value="POP">Pop</option>
                <option value="SLIDE">Slide</option>
                <option value="GLOW">Glow</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <button onClick={() => setStyle(prev => ({ ...prev, bold: !prev.bold }))} className={`px-2 py-1.5 rounded-lg border ${style.bold ? 'border-cyan-400 text-cyan-300' : 'border-white/15'}`}>Bold</button>
              <button onClick={() => setStyle(prev => ({ ...prev, italic: !prev.italic }))} className={`px-2 py-1.5 rounded-lg border ${style.italic ? 'border-cyan-400 text-cyan-300' : 'border-white/15'}`}>Italic</button>
              <button onClick={() => setStyle(prev => ({ ...prev, uppercase: !prev.uppercase }))} className={`px-2 py-1.5 rounded-lg border ${style.uppercase ? 'border-cyan-400 text-cyan-300' : 'border-white/15'}`}>Upper</button>
            </div>
          </div>
        </aside>

        <section className="bg-[#040406] flex flex-col p-4 md:p-6 gap-4">
          <div className="relative flex-1 min-h-[300px] rounded-3xl border border-white/10 bg-black overflow-hidden">
            {!mediaUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                <Sparkles size={28} className="mb-3" />
                <p className="text-sm uppercase font-bold tracking-wider">Subtitle preview</p>
              </div>
            )}

            {mediaUrl && isVideo && (
              <video
                ref={node => { mediaRef.current = node; }}
                src={mediaUrl}
                className="w-full h-full object-contain"
                onTimeUpdate={syncCurrentTime}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                controls={false}
              />
            )}
            {mediaUrl && !isVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0A0A0D] to-black">
                <div className="w-20 h-20 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mb-4">
                  <FileText className="text-cyan-300" size={34} />
                </div>
                <p className="text-sm text-gray-400">Audio mode preview</p>
                <audio
                  ref={node => { mediaRef.current = node; }}
                  src={mediaUrl}
                  onTimeUpdate={syncCurrentTime}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  controls={false}
                />
              </div>
            )}

            {activeText && (
              <div className={`absolute left-0 right-0 px-4 md:px-10 flex justify-center pointer-events-none ${overlayPositionClass} ${overlayAnimationClass}`}>
                <div
                  style={{
                    fontFamily: style.fontFamily,
                    fontSize: `${style.fontSize}px`,
                    color: style.textColor,
                    backgroundColor: style.backgroundColor,
                    fontWeight: style.bold ? 800 : 500,
                    fontStyle: style.italic ? 'italic' : 'normal',
                    textTransform: style.uppercase ? 'uppercase' : 'none',
                    letterSpacing: `${style.letterSpacing}px`,
                    maxWidth: `${style.maxWidthPercent}%`,
                    padding: '0.35em 0.65em',
                    borderRadius: 10,
                    lineHeight: 1.2,
                    textAlign: 'center',
                    WebkitTextStroke: `${style.outlineSize}px ${style.outlineColor}`,
                    textShadow: style.shadow ? '0 3px 16px rgba(0,0,0,0.75)' : 'none'
                  }}
                >
                  {activeText}
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#09090C] rounded-2xl border border-white/10 p-3 flex flex-wrap items-center gap-2">
            <button onClick={togglePlayback} disabled={!mediaUrl} className="px-3 py-2 rounded-lg bg-white text-black text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button onClick={addCueAtCurrentTime} className="px-3 py-2 rounded-lg border border-white/15 text-xs hover:bg-white/10 flex items-center gap-2">
              <Plus size={14} /> Add cue @ {formatPreviewTime(currentTime)}
            </button>
            <div className="h-6 w-px bg-white/10" />
            <button
              onClick={() => setDisplayMode('TRANSLATED')}
              className={`px-3 py-2 rounded-lg text-xs border ${displayMode === 'TRANSLATED' ? 'border-cyan-400 text-cyan-300' : 'border-white/15 hover:bg-white/10'}`}
            >
              Show translated
            </button>
            <button
              onClick={() => setDisplayMode('ORIGINAL')}
              className={`px-3 py-2 rounded-lg text-xs border ${displayMode === 'ORIGINAL' ? 'border-cyan-400 text-cyan-300' : 'border-white/15 hover:bg-white/10'}`}
            >
              Show original
            </button>
            <div className="ml-auto text-[11px] text-gray-400 font-mono">
              {formatPreviewTime(currentTime)}
            </div>
          </div>
        </section>

        <aside className="border-l border-white/10 bg-[#08080B] overflow-y-auto custom-scrollbar p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black uppercase tracking-widest">Cue editor</h3>
            <span className="text-[10px] text-gray-500">{cues.length} cues</span>
          </div>

          <div className="space-y-3">
            {cues.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 p-5 text-xs text-gray-500">
                Run transcription, then edit text/timing here.
              </div>
            )}

            {cues.map(cue => (
              <div key={cue.id} className={`rounded-2xl border p-3 space-y-2 ${activeCue?.id === cue.id ? 'border-cyan-400/60 bg-cyan-500/5' : 'border-white/10 bg-white/5'}`}>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">
                    Start
                    <input
                      type="number"
                      step={0.01}
                      value={Number(cue.startSec.toFixed(2))}
                      onChange={e => patchCue(cue.id, { startSec: Number(e.target.value) })}
                      className="w-full mt-1 bg-black/40 rounded-lg border border-white/10 px-2 py-1.5 text-xs outline-none"
                    />
                  </label>
                  <label className="text-[10px] text-gray-400 font-bold uppercase">
                    End
                    <input
                      type="number"
                      step={0.01}
                      value={Number(cue.endSec.toFixed(2))}
                      onChange={e => patchCue(cue.id, { endSec: Number(e.target.value) })}
                      className="w-full mt-1 bg-black/40 rounded-lg border border-white/10 px-2 py-1.5 text-xs outline-none"
                    />
                  </label>
                </div>

                <label className="text-[10px] text-gray-400 font-bold uppercase block">
                  Source text
                  <textarea
                    value={cue.text}
                    onChange={e => patchCue(cue.id, { text: e.target.value })}
                    className="w-full mt-1 min-h-[58px] bg-black/40 rounded-lg border border-white/10 px-2 py-1.5 text-xs outline-none resize-y"
                  />
                </label>

                <label className="text-[10px] text-gray-400 font-bold uppercase block">
                  Translated text
                  <textarea
                    value={cue.translatedText || ''}
                    onChange={e => patchCue(cue.id, { translatedText: e.target.value })}
                    className="w-full mt-1 min-h-[58px] bg-black/40 rounded-lg border border-white/10 px-2 py-1.5 text-xs outline-none resize-y"
                  />
                </label>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => seekTo(cue.startSec)}
                    className="text-[10px] px-2 py-1 rounded-md border border-white/15 hover:bg-white/10"
                  >
                    Jump
                  </button>
                  <button
                    onClick={() => removeCue(cue.id)}
                    className="text-[10px] px-2 py-1 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
