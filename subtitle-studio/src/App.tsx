import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  CheckCircle2,
  Download,
  FileUp,
  Languages,
  ListOrdered,
  Loader2,
  MonitorSmartphone,
  Pause,
  Play,
  Plus,
  Rocket,
  Save,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2
} from 'lucide-react';
import type {
  SubtitleCue,
  SubtitleProjectSnapshot,
  SubtitleStyle,
  SubtitleTranscriptionOptions
} from './types';
import {
  analyzeSubtitleQuality,
  parseSrt,
  parseVtt,
  downloadTextFile,
  normalizeSubtitleCues,
  subtitlesToCsv,
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

type DisplayMode = 'TRANSLATED' | 'ORIGINAL' | 'BILINGUAL';
type QueueStatus = 'IDLE' | 'PROCESSING' | 'DONE' | 'ERROR';

interface QueueItem {
  id: string;
  name: string;
  file?: File;
  url?: string;
  isVideo: boolean;
  status: QueueStatus;
  progress: number;
  error?: string;
  cues: SubtitleCue[];
  detectedLanguage?: string;
  summary?: string;
}

const STORAGE_KEY = 'subtitle-studio:last-snapshot:v2';

export default function App() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isQueueRunning, setIsQueueRunning] = useState(false);

  const [sourceLanguage, setSourceLanguage] = useState('Auto detect');
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [customTargetLanguage, setCustomTargetLanguage] = useState('');
  const [aiProfile, setAiProfile] = useState<SubtitleTranscriptionOptions['aiProfile']>('MAX_QUALITY');
  const [includeSpeakerLabels, setIncludeSpeakerLabels] = useState(false);
  const [maxCharsPerLine, setMaxCharsPerLine] = useState(38);
  const [preserveFillerWords, setPreserveFillerWords] = useState(true);
  const [detectedLanguage, setDetectedLanguage] = useState('—');
  const [summary, setSummary] = useState('');

  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('TRANSLATED');

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  const resolvedTargetLanguage = customTargetLanguage.trim() || targetLanguage;
  const activeItem = useMemo(() => queue.find(item => item.id === activeItemId) || null, [queue, activeItemId]);
  const activeCues = activeItem?.cues || [];
  const mediaUrl = activeItem?.url || null;
  const isVideo = activeItem?.isVideo || false;
  const processing = activeItem?.status === 'PROCESSING';
  const progress = activeItem?.progress || 0;

  const activeCue = useMemo(
    () => activeCues.find(cue => currentTime >= cue.startSec && currentTime <= cue.endSec) || null,
    [activeCues, currentTime]
  );

  const onDrop = useCallback((files: File[]) => {
    if (files.length === 0) return;

    const newItems = files.map((file, index) => ({
      id: `job-${Date.now()}-${index}-${Math.floor(Math.random() * 9999)}`,
      name: file.name,
      file,
      url: URL.createObjectURL(file),
      isVideo: file.type.startsWith('video/'),
      status: 'IDLE' as QueueStatus,
      progress: 0,
      cues: []
    }));

    setQueue(prev => {
      const next = [...prev, ...newItems];
      if (!activeItemId && next.length > 0) setActiveItemId(next[0].id);
      return next;
    });

    setCurrentTime(0);
    setPlaying(false);
    setError('');
    setSummary('');
    setDetectedLanguage('—');
    setInfo(`Added ${newItems.length} file(s) to queue.`);
  }, [activeItemId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 25,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'],
      'video/*': ['.mp4', '.mov', '.m4v', '.mkv', '.webm']
    }
  } as any);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    return () => {
      for (const item of queueRef.current) {
        if (item.url) URL.revokeObjectURL(item.url);
      }
    };
  }, []);

  const updateQueueItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }, []);

  const processOneItem = useCallback(async (id: string) => {
    const current = queueRef.current.find(item => item.id === id);
    if (!current?.file) return;
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setError('Missing VITE_GEMINI_API_KEY in .env.local');
      return;
    }

    updateQueueItem(id, { status: 'PROCESSING', progress: 0, error: undefined });
    setError('');

    try {
      const result = await transcribeAndTranslateMedia(
        current.file,
        {
          sourceLanguage,
          targetLanguage: resolvedTargetLanguage,
          aiProfile,
          includeSpeakerLabels,
          maxCharsPerLine,
          preserveFillerWords
        },
        (p) => updateQueueItem(id, { progress: p })
      );
      const normalized = normalizeSubtitleCues(result.cues);
      updateQueueItem(id, {
        status: 'DONE',
        progress: 100,
        cues: normalized,
        detectedLanguage: result.detectedLanguage,
        summary: result.summary || ''
      });

      if (id === activeItemId) {
        setDetectedLanguage(result.detectedLanguage);
        setSummary(result.summary || '');
      }
      setDisplayMode('TRANSLATED');
    } catch (err: any) {
      updateQueueItem(id, { status: 'ERROR', error: err?.message || 'Transcription failed.' });
      if (id === activeItemId) setError(err?.message || 'Transcription failed.');
    }
  }, [
    activeItemId,
    aiProfile,
    includeSpeakerLabels,
    maxCharsPerLine,
    preserveFillerWords,
    resolvedTargetLanguage,
    sourceLanguage,
    updateQueueItem
  ]);

  const transcribe = async () => {
    if (!activeItemId) {
      setError('Upload at least one media file.');
      return;
    }
    await processOneItem(activeItemId);
  };

  const processQueue = async () => {
    if (queue.length === 0) {
      setError('Upload files before running batch processing.');
      return;
    }
    setIsQueueRunning(true);
    setInfo('Batch processing started.');
    try {
      const pendingIds = queueRef.current
        .filter(item => item.file && item.status !== 'DONE')
        .map(item => item.id);
      for (const id of pendingIds) {
        await processOneItem(id);
      }
      setInfo('Batch processing completed.');
    } finally {
      setIsQueueRunning(false);
    }
  };

  const retranslate = async () => {
    if (!activeItem || activeCues.length === 0) return;
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setError('Missing VITE_GEMINI_API_KEY in .env.local');
      return;
    }
    setTranslating(true);
    setError('');
    try {
      const translated = await translateSubtitleCues(activeCues, resolvedTargetLanguage, sourceLanguage, aiProfile);
      updateQueueItem(activeItem.id, { cues: normalizeSubtitleCues(translated) });
      setDisplayMode('TRANSLATED');
    } catch (err: any) {
      setError(err?.message || 'Translation failed.');
    } finally {
      setTranslating(false);
    }
  };

  const patchCue = (cueId: string, patch: Partial<SubtitleCue>) => {
    if (!activeItem) return;
    updateQueueItem(activeItem.id, {
      cues: normalizeSubtitleCues(activeCues.map(cue => cue.id === cueId ? { ...cue, ...patch } : cue))
    });
  };

  const removeCue = (cueId: string) => {
    if (!activeItem) return;
    updateQueueItem(activeItem.id, { cues: activeCues.filter(cue => cue.id !== cueId) });
  };

  const addCue = () => {
    if (!activeItem) return;
    updateQueueItem(activeItem.id, { cues: normalizeSubtitleCues([...activeCues, makeCue(currentTime)]) });
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

  const autoFixTiming = () => {
    if (!activeItem || activeCues.length === 0) return;
    const fixed = normalizeSubtitleCues(activeCues).map(cue => ({ ...cue }));
    for (let i = 0; i < fixed.length - 1; i++) {
      const current = fixed[i];
      const next = fixed[i + 1];
      if (current.endSec > next.startSec - 0.05) {
        current.endSec = Math.max(current.startSec + 0.2, next.startSec - 0.05);
      }
      if (current.endSec <= current.startSec) current.endSec = current.startSec + 0.2;
    }
    updateQueueItem(activeItem.id, { cues: fixed });
  };

  const removeQueueItem = (id: string) => {
    const target = queueRef.current.find(item => item.id === id);
    if (target?.url) URL.revokeObjectURL(target.url);
    setQueue(prev => prev.filter(item => item.id !== id));
    if (activeItemId === id) {
      const remaining = queueRef.current.filter(item => item.id !== id);
      setActiveItemId(remaining[0]?.id || null);
      setCurrentTime(0);
      setPlaying(false);
    }
  };

  const baseName = (activeItem?.name || 'subtitles').replace(/\.[^/.]+$/, '');
  const exportSrt = () => {
    const content = subtitlesToSrt(activeCues, displayMode !== 'ORIGINAL');
    downloadTextFile(content, `${baseName}.${displayMode === 'TRANSLATED' ? resolvedTargetLanguage : 'source'}.srt`, 'text/plain;charset=utf-8');
  };
  const exportVtt = () => {
    const content = subtitlesToVtt(activeCues, displayMode !== 'ORIGINAL');
    downloadTextFile(content, `${baseName}.${displayMode === 'TRANSLATED' ? resolvedTargetLanguage : 'source'}.vtt`, 'text/vtt;charset=utf-8');
  };
  const exportCsv = () => {
    const content = subtitlesToCsv(activeCues, displayMode !== 'ORIGINAL');
    downloadTextFile(content, `${baseName}.${displayMode === 'TRANSLATED' ? resolvedTargetLanguage : 'source'}.csv`, 'text/csv;charset=utf-8');
  };
  const exportProject = () => {
    if (!activeItem) return;
    const payload = {
      sourceFile: activeItem.name || null,
      sourceLanguage,
      detectedLanguage,
      targetLanguage: resolvedTargetLanguage,
      style,
      cues: activeCues
    };
    downloadTextFile(JSON.stringify(payload, null, 2), `${baseName}.subtitle-project.json`, 'application/json;charset=utf-8');
  };

  const importSubtitleFile = async (file: File) => {
    const text = await file.text();
    const lower = file.name.toLowerCase();

    let imported: SubtitleCue[] = [];
    if (lower.endsWith('.srt')) imported = parseSrt(text);
    else if (lower.endsWith('.vtt')) imported = parseVtt(text);
    else if (lower.endsWith('.json')) {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) imported = normalizeSubtitleCues(parsed);
      else if (Array.isArray(parsed?.cues)) imported = normalizeSubtitleCues(parsed.cues);
    }

    if (imported.length === 0) {
      setError('Could not parse subtitle file. Use .srt, .vtt, or .json.');
      return;
    }

    const virtualItem: QueueItem = {
      id: `import-${Date.now()}`,
      name: file.name,
      isVideo: false,
      status: 'DONE',
      progress: 100,
      cues: imported,
      summary: 'Imported subtitle file'
    };
    setQueue(prev => [virtualItem, ...prev]);
    setActiveItemId(virtualItem.id);
    setInfo(`Imported ${file.name} with ${imported.length} cues.`);
  };

  const qualityReport = useMemo(() => analyzeSubtitleQuality(activeCues), [activeCues]);

  const activeText = activeCue
    ? displayMode === 'ORIGINAL'
      ? activeCue.text
      : displayMode === 'BILINGUAL'
        ? `${activeCue.text}\n${activeCue.translatedText || activeCue.text}`
        : (activeCue.translatedText || activeCue.text)
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

  useEffect(() => {
    if (!activeItemId) return;
    const active = queue.find(item => item.id === activeItemId);
    if (!active) return;
    setDetectedLanguage(active.detectedLanguage || '—');
    setSummary(active.summary || '');
    setCurrentTime(0);
    setPlaying(false);
  }, [activeItemId, queue]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (typing) return;
      if (event.code === 'Space') {
        event.preventDefault();
        void togglePlay();
      }
      if (event.key === 'ArrowRight') seekTo(currentTime + 1);
      if (event.key === 'ArrowLeft') seekTo(currentTime - 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentTime]);

  useEffect(() => {
    if (!activeItem) return;
    const snapshot: SubtitleProjectSnapshot = {
      sourceLanguage,
      targetLanguage,
      customTargetLanguage,
      detectedLanguage,
      style,
      displayMode,
      cues: activeCues,
      aiProfile,
      includeSpeakerLabels,
      maxCharsPerLine,
      preserveFillerWords
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [
    activeItem,
    activeCues,
    aiProfile,
    customTargetLanguage,
    detectedLanguage,
    displayMode,
    includeSpeakerLabels,
    maxCharsPerLine,
    preserveFillerWords,
    sourceLanguage,
    style,
    targetLanguage
  ]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as SubtitleProjectSnapshot;
      setSourceLanguage(saved.sourceLanguage || 'Auto detect');
      setTargetLanguage(saved.targetLanguage || 'English');
      setCustomTargetLanguage(saved.customTargetLanguage || '');
      setDetectedLanguage(saved.detectedLanguage || '—');
      setStyle(saved.style || DEFAULT_STYLE);
      setDisplayMode(saved.displayMode || 'TRANSLATED');
      setAiProfile(saved.aiProfile || 'MAX_QUALITY');
      setIncludeSpeakerLabels(Boolean(saved.includeSpeakerLabels));
      setMaxCharsPerLine(saved.maxCharsPerLine || 38);
      setPreserveFillerWords(saved.preserveFillerWords ?? true);
      if (saved.cues?.length) {
        const recovered: QueueItem = {
          id: `recovered-${Date.now()}`,
          name: 'Recovered session',
          isVideo: false,
          status: 'DONE',
          progress: 100,
          cues: normalizeSubtitleCues(saved.cues)
        };
        setQueue([recovered]);
        setActiveItemId(recovered.id);
      }
    } catch {
      // Ignore invalid snapshots.
    }
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Subtitle Studio</h1>
          <p>Pro transcription + translation for mobile & desktop</p>
        </div>
        <div className="header-actions">
          <button onClick={processQueue} disabled={queue.length === 0 || isQueueRunning}>
            {isQueueRunning ? <Loader2 size={14} className="spin" /> : <ListOrdered size={14} />}
            Queue
          </button>
          <button onClick={exportSrt} disabled={activeCues.length === 0}><Download size={14} />SRT</button>
          <button onClick={exportVtt} disabled={activeCues.length === 0}><Download size={14} />VTT</button>
          <button onClick={exportCsv} disabled={activeCues.length === 0}><Download size={14} />CSV</button>
          <button onClick={exportProject} disabled={activeCues.length === 0}><Save size={14} />JSON</button>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            <UploadCloud size={28} />
            <h3>Upload audio or video</h3>
            <p>Multi-file queue (mobile + desktop)</p>
            {activeItem && <small>{activeItem.name}</small>}
          </div>

          <div className="button-row">
            <button
              onClick={() => importRef.current?.click()}
              disabled={processing}
            >
              <FileUp size={14} />Import SRT/VTT/JSON
            </button>
            <button onClick={() => setInfo('Tip: Space = play/pause, arrows = seek.')}>
              <MonitorSmartphone size={14} />Shortcuts
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept=".srt,.vtt,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importSubtitleFile(file);
              e.currentTarget.value = '';
            }}
          />

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

          <div className="style-editor">
            <h4>AI quality profile</h4>
            <div className="preset-row">
              <button onClick={() => setAiProfile('SPEED')} className={aiProfile === 'SPEED' ? 'active' : ''}>Speed</button>
              <button onClick={() => setAiProfile('BALANCED')} className={aiProfile === 'BALANCED' ? 'active' : ''}>Balanced</button>
              <button onClick={() => setAiProfile('MAX_QUALITY')} className={aiProfile === 'MAX_QUALITY' ? 'active' : ''}>Max Quality</button>
            </div>
            <div className="field-grid">
              <label>
                Max chars/line
                <input
                  type="number"
                  min={20}
                  max={64}
                  value={maxCharsPerLine}
                  onChange={e => setMaxCharsPerLine(Math.max(20, Math.min(64, Number(e.target.value) || 38)))}
                />
              </label>
              <label>
                Speaker labels
                <select value={includeSpeakerLabels ? 'YES' : 'NO'} onChange={e => setIncludeSpeakerLabels(e.target.value === 'YES')}>
                  <option value="NO">No</option>
                  <option value="YES">Yes</option>
                </select>
              </label>
            </div>
            <div className="field-grid">
              <label>
                Keep filler words
                <select value={preserveFillerWords ? 'YES' : 'NO'} onChange={e => setPreserveFillerWords(e.target.value === 'YES')}>
                  <option value="YES">Yes</option>
                  <option value="NO">No</option>
                </select>
              </label>
              <label>
                Readability score
                <input value={`${qualityReport.score}/100`} readOnly />
              </label>
            </div>
          </div>

          <div className="button-row">
            <button className="primary" onClick={transcribe} disabled={!activeItem || processing}>
              {processing ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />}
              {processing ? `${progress}%` : 'Transcribe + Translate'}
            </button>
            <button onClick={retranslate} disabled={activeCues.length === 0 || translating}>
              {translating ? <Loader2 size={14} className="spin" /> : <Languages size={14} />}
              Retranslate
            </button>
          </div>

          <div className="button-row">
            <button onClick={autoFixTiming} disabled={activeCues.length === 0}>
              <Rocket size={14} />Auto-fix timing
            </button>
            <button onClick={processQueue} disabled={queue.length === 0 || isQueueRunning}>
              {isQueueRunning ? <Loader2 size={14} className="spin" /> : <ListOrdered size={14} />}
              Run batch
            </button>
          </div>

          <div className="meta-box">
            <div>Detected: <b>{detectedLanguage}</b></div>
            <div>Target: <b>{resolvedTargetLanguage}</b></div>
            <div>Cues: <b>{activeCues.length}</b></div>
            <div>Queue: <b>{queue.length}</b></div>
            <div>Quality score: <b>{qualityReport.score}</b></div>
            {summary && <p>{summary}</p>}
            {info && <p>{info}</p>}
            {error && <p className="error">{error}</p>}
          </div>

          {queue.length > 0 && (
            <div className="queue-list">
              {queue.map(item => (
                <div
                  key={item.id}
                  className={`queue-item ${activeItemId === item.id ? 'active' : ''}`}
                >
                  <button onClick={() => setActiveItemId(item.id)} className="queue-item-main">
                    <span>{item.name}</span>
                    <small>
                      {item.status === 'DONE' && <CheckCircle2 size={12} />}
                      {item.status === 'PROCESSING' ? `${item.progress}%` : item.status}
                    </small>
                  </button>
                  <button onClick={() => removeQueueItem(item.id)} className="queue-remove">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
            <button onClick={() => setDisplayMode('BILINGUAL')} className={displayMode === 'BILINGUAL' ? 'active' : ''}>Bi-lingual</button>
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
            <span>{activeCues.length}</span>
          </div>

          <div className="cue-list">
            {qualityReport.issues.slice(0, 5).map(issue => (
              <p key={`${issue.cueId}-${issue.message}`} className={`quality quality-${issue.severity.toLowerCase()}`}>
                {issue.message}
              </p>
            ))}
            {activeCues.length === 0 && <p className="empty">Generate subtitles, then edit here.</p>}
            {activeCues.map(cue => (
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
