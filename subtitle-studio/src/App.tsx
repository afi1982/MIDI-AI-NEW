import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Download,
  Languages,
  Loader2,
  Pause,
  Play,
  Plus,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2
} from 'lucide-react';
import type { SubtitleCue, SubtitleStyle } from './types';
import {
  downloadTextFile,
  normalizeSubtitleCues,
  subtitlesToSrt,
  subtitlesToVtt,
  transcribeAndTranslateMedia,
  translateSubtitleCues
} from './services/subtitleService';

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
  fontSize: 34,
  textColor: '#ffffff',
  backgroundColor: 'rgba(0,0,0,0.45)',
  outlineColor: '#000000',
  outlineSize: 2,
  bold: true,
  italic: false,
  uppercase: false,
  shadow: true,
  letterSpacing: 0.2,
  maxWidthPercent: 88,
  position: 'BOTTOM',
  animation: 'POP'
};

const PRESETS: Array<{ id: string; label: string; patch: Partial<SubtitleStyle> }> = [
  {
    id: 'tiktok',
    label: 'TikTok',
    patch: {
      fontSize: 36,
      textColor: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.45)',
      outlineColor: '#000000',
      outlineSize: 2,
      position: 'BOTTOM',
      animation: 'POP'
    }
  },
  {
    id: 'neon',
    label: 'Neon',
    patch: {
      textColor: '#22d3ee',
      backgroundColor: 'rgba(2, 6, 23, 0.35)',
      outlineColor: '#0e7490',
      outlineSize: 1,
      animation: 'GLOW'
    }
  },
  {
    id: 'center',
    label: 'Center',
    patch: {
      position: 'CENTER',
      fontSize: 42,
      textColor: '#fef08a',
      backgroundColor: 'rgba(0,0,0,0.55)',
      animation: 'SLIDE'
    }
  }
];

const formatTime = (sec: number): string => {
  const safe = Math.max(0, sec || 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.floor((safe - Math.floor(safe)) * 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};

const makeCue = (startSec: number): SubtitleCue => ({
  id: `cue-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
  startSec,
  endSec: startSec + 2,
  text: '',
  translatedText: ''
});

export default function App() {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);

  const [sourceLanguage, setSourceLanguage] = useState('Auto detect');
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [customTargetLanguage, setCustomTargetLanguage] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState('—');
  const [summary, setSummary] = useState('');

  const [processing, setProcessing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);
  const [displayMode, setDisplayMode] = useState<'TRANSLATED' | 'ORIGINAL'>('TRANSLATED');
  const [cues, setCues] = useState<SubtitleCue[]>([]);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const mediaRef = useRef<HTMLMediaElement | null>(null);

  const resolvedTargetLanguage = customTargetLanguage.trim() || targetLanguage;

  const activeCue = useMemo(
    () => cues.find(cue => currentTime >= cue.startSec && currentTime <= cue.endSec) || null,
    [cues, currentTime]
  );

  const onDrop = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    const url = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaUrl(url);
    setIsVideo(file.type.startsWith('video/'));
    setCurrentTime(0);
    setPlaying(false);
    setCues([]);
    setError('');
    setSummary('');
    setProgress(0);
    setDetectedLanguage('—');
  }, [mediaUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'],
      'video/*': ['.mp4', '.mov', '.m4v', '.mkv', '.webm']
    }
  } as any);

  useEffect(() => () => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  }, [mediaUrl]);

  const transcribe = async () => {
    if (!mediaFile) return;
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setError('Missing VITE_GEMINI_API_KEY in .env.local');
      return;
    }
    setProcessing(true);
    setError('');
    setSummary('');
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
      setError(err?.message || 'Transcription failed.');
    } finally {
      setProcessing(false);
    }
  };

  const retranslate = async () => {
    if (cues.length === 0) return;
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setError('Missing VITE_GEMINI_API_KEY in .env.local');
      return;
    }
    setTranslating(true);
    setError('');
    try {
      const translated = await translateSubtitleCues(cues, resolvedTargetLanguage, sourceLanguage);
      setCues(normalizeSubtitleCues(translated));
      setDisplayMode('TRANSLATED');
    } catch (err: any) {
      setError(err?.message || 'Translation failed.');
    } finally {
      setTranslating(false);
    }
  };

  const patchCue = (cueId: string, patch: Partial<SubtitleCue>) => {
    setCues(prev => normalizeSubtitleCues(prev.map(cue => cue.id === cueId ? { ...cue, ...patch } : cue)));
  };

  const removeCue = (cueId: string) => {
    setCues(prev => prev.filter(cue => cue.id !== cueId));
  };

  const addCue = () => {
    setCues(prev => normalizeSubtitleCues([...prev, makeCue(currentTime)]));
  };

  const syncTime = () => {
    if (!mediaRef.current) return;
    setCurrentTime(mediaRef.current.currentTime || 0);
  };

  const seekTo = (sec: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = Math.max(0, sec);
    setCurrentTime(Math.max(0, sec));
  };

  const togglePlay = async () => {
    if (!mediaRef.current) return;
    if (mediaRef.current.paused) {
      await mediaRef.current.play();
      setPlaying(true);
    } else {
      mediaRef.current.pause();
      setPlaying(false);
    }
  };

  const applyPreset = (id: string) => {
    const preset = PRESETS.find(item => item.id === id);
    if (!preset) return;
    setStyle(prev => ({ ...prev, ...preset.patch }));
  };

  const baseName = (mediaFile?.name || 'subtitles').replace(/\.[^/.]+$/, '');
  const exportSrt = () => {
    const content = subtitlesToSrt(cues, displayMode === 'TRANSLATED');
    downloadTextFile(content, `${baseName}.${displayMode === 'TRANSLATED' ? resolvedTargetLanguage : 'source'}.srt`, 'text/plain;charset=utf-8');
  };
  const exportVtt = () => {
    const content = subtitlesToVtt(cues, displayMode === 'TRANSLATED');
    downloadTextFile(content, `${baseName}.${displayMode === 'TRANSLATED' ? resolvedTargetLanguage : 'source'}.vtt`, 'text/vtt;charset=utf-8');
  };
  const exportProject = () => {
    const payload = {
      sourceFile: mediaFile?.name || null,
      sourceLanguage,
      detectedLanguage,
      targetLanguage: resolvedTargetLanguage,
      style,
      cues
    };
    downloadTextFile(JSON.stringify(payload, null, 2), `${baseName}.subtitle-project.json`, 'application/json;charset=utf-8');
  };

  const activeText = activeCue
    ? (displayMode === 'TRANSLATED' ? (activeCue.translatedText || activeCue.text) : activeCue.text)
    : '';

  const positionClass = style.position === 'TOP'
    ? 'top-4'
    : style.position === 'CENTER'
      ? 'top-1/2 -translate-y-1/2'
      : 'bottom-4';

  const animationClass = style.animation === 'NONE'
    ? ''
    : style.animation === 'SLIDE'
      ? 'subtitle-animate-slide'
      : style.animation === 'GLOW'
        ? 'subtitle-animate-glow'
        : 'subtitle-animate-pop';

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Subtitle Studio</h1>
          <p>Standalone mobile subtitle workflow</p>
        </div>
        <div className="header-actions">
          <button onClick={exportSrt} disabled={cues.length === 0}><Download size={14} />SRT</button>
          <button onClick={exportVtt} disabled={cues.length === 0}><Download size={14} />VTT</button>
          <button onClick={exportProject} disabled={cues.length === 0}><Download size={14} />JSON</button>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            <UploadCloud size={28} />
            <h3>Upload audio or video</h3>
            <p>Drag and drop, or tap to choose file</p>
            {mediaFile && <small>{mediaFile.name}</small>}
          </div>

          <div className="field-grid">
            <label>
              Source language
              <select value={sourceLanguage} onChange={e => setSourceLanguage(e.target.value)}>
                {LANGUAGES.map(lang => <option key={`source-${lang}`} value={lang}>{lang}</option>)}
              </select>
            </label>
            <label>
              Target language
              <select value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)}>
                {LANGUAGES.filter(lang => lang !== 'Auto detect').map(lang => <option key={`target-${lang}`} value={lang}>{lang}</option>)}
              </select>
            </label>
          </div>

          <label className="custom-target">
            Custom target language (optional)
            <input
              value={customTargetLanguage}
              onChange={e => setCustomTargetLanguage(e.target.value)}
              placeholder="Any language (e.g. Swahili, Greek, Persian)"
            />
          </label>

          <div className="button-row">
            <button className="primary" onClick={transcribe} disabled={!mediaFile || processing}>
              {processing ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />}
              {processing ? `${progress}%` : 'Transcribe + Translate'}
            </button>
            <button onClick={retranslate} disabled={cues.length === 0 || translating}>
              {translating ? <Loader2 size={14} className="spin" /> : <Languages size={14} />}
              Retranslate
            </button>
          </div>

          <div className="meta-box">
            <div>Detected: <b>{detectedLanguage}</b></div>
            <div>Target: <b>{resolvedTargetLanguage}</b></div>
            <div>Cues: <b>{cues.length}</b></div>
            {summary && <p>{summary}</p>}
            {error && <p className="error">{error}</p>}
          </div>
        </section>

        <section className="panel preview-panel">
          <div className="preview">
            {!mediaUrl && (
              <div className="placeholder">
                <Sparkles size={26} />
                <span>Live subtitle preview</span>
              </div>
            )}

            {mediaUrl && isVideo && (
              <video
                ref={node => { mediaRef.current = node; }}
                src={mediaUrl}
                onTimeUpdate={syncTime}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                className="media"
              />
            )}
            {mediaUrl && !isVideo && (
              <div className="audio-preview">
                <audio
                  ref={node => { mediaRef.current = node; }}
                  src={mediaUrl}
                  onTimeUpdate={syncTime}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />
                <p>Audio preview mode</p>
              </div>
            )}

            {activeText && (
              <div className={`subtitle-overlay ${positionClass} ${animationClass}`}>
                <span
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
                    WebkitTextStroke: `${style.outlineSize}px ${style.outlineColor}`,
                    textShadow: style.shadow ? '0 3px 14px rgba(0,0,0,0.75)' : 'none'
                  }}
                >
                  {activeText}
                </span>
              </div>
            )}
          </div>

          <div className="playback-row">
            <button onClick={togglePlay} disabled={!mediaUrl}>
              {playing ? <Pause size={14} /> : <Play size={14} />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <button onClick={addCue}><Plus size={14} />Add cue at {formatTime(currentTime)}</button>
            <button onClick={() => setDisplayMode('TRANSLATED')} className={displayMode === 'TRANSLATED' ? 'active' : ''}>Translated</button>
            <button onClick={() => setDisplayMode('ORIGINAL')} className={displayMode === 'ORIGINAL' ? 'active' : ''}>Original</button>
            <span className="time">{formatTime(currentTime)}</span>
          </div>

          <div className="style-editor">
            <h4>TikTok style controls</h4>
            <div className="preset-row">
              {PRESETS.map(preset => (
                <button key={preset.id} onClick={() => applyPreset(preset.id)}>{preset.label}</button>
              ))}
            </div>

            <div className="field-grid">
              <label>
                Font size
                <input
                  type="range"
                  min={20}
                  max={72}
                  value={style.fontSize}
                  onChange={e => setStyle(prev => ({ ...prev, fontSize: Number(e.target.value) }))}
                />
              </label>
              <label>
                Outline
                <input
                  type="range"
                  min={0}
                  max={6}
                  value={style.outlineSize}
                  onChange={e => setStyle(prev => ({ ...prev, outlineSize: Number(e.target.value) }))}
                />
              </label>
            </div>

            <div className="field-grid">
              <label>
                Position
                <select value={style.position} onChange={e => setStyle(prev => ({ ...prev, position: e.target.value as SubtitleStyle['position'] }))}>
                  <option value="TOP">Top</option>
                  <option value="CENTER">Center</option>
                  <option value="BOTTOM">Bottom</option>
                </select>
              </label>
              <label>
                Animation
                <select value={style.animation} onChange={e => setStyle(prev => ({ ...prev, animation: e.target.value as SubtitleStyle['animation'] }))}>
                  <option value="NONE">None</option>
                  <option value="POP">Pop</option>
                  <option value="SLIDE">Slide</option>
                  <option value="GLOW">Glow</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="panel editor-panel">
          <div className="editor-header">
            <h3>Subtitle cues</h3>
            <span>{cues.length}</span>
          </div>

          <div className="cue-list">
            {cues.length === 0 && <p className="empty">Generate subtitles, then edit here.</p>}
            {cues.map(cue => (
              <article key={cue.id} className={`cue-card ${activeCue?.id === cue.id ? 'current' : ''}`}>
                <div className="time-grid">
                  <label>
                    Start
                    <input
                      type="number"
                      step={0.01}
                      value={Number(cue.startSec.toFixed(2))}
                      onChange={e => patchCue(cue.id, { startSec: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    End
                    <input
                      type="number"
                      step={0.01}
                      value={Number(cue.endSec.toFixed(2))}
                      onChange={e => patchCue(cue.id, { endSec: Number(e.target.value) })}
                    />
                  </label>
                </div>

                <label>
                  Source text
                  <textarea
                    value={cue.text}
                    onChange={e => patchCue(cue.id, { text: e.target.value })}
                  />
                </label>
                <label>
                  Translated text
                  <textarea
                    value={cue.translatedText || ''}
                    onChange={e => patchCue(cue.id, { translatedText: e.target.value })}
                  />
                </label>

                <div className="cue-actions">
                  <button onClick={() => seekTo(cue.startSec)}>Jump</button>
                  <button className="danger" onClick={() => removeCue(cue.id)}>
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
