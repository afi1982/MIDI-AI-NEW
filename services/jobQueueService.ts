
import { GrooveObject, GenerationParams, ChannelKey, MusicGenre } from '../types';
import { generateTranceSequence, deconstructYoutubeLink, generateDivineMelody } from './geminiService';
import { maestroService, ELITE_16_CHANNELS } from './maestroService.ts';
import { forensicFixerService } from './forensicFixerService';
import { contextBridge } from './contextBridgeService';
import { midiRendererService, RenderProfile } from './midiRendererService';
import { inspectAndHealGroove, inspectAudioBlob, QualityReport } from './qualityGateService';
import { describeAudioPickError } from './audioFilePicker';
import { analyzeSongToStems, arrangeTranceFromAnalysis, arrangeMelodyOnly, decodeIfAudio } from './audioStemService';

export type JobType = 'MIDI_GENERATION' | 'AUDIO_REGRESSION' | 'FORENSIC_ANALYSIS' | 'FORENSIC_STUDY' | 'MELODY_ARCHITECT' | 'MIDI_RENDER';
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Job {
    id: string;
    type: JobType;
    status: JobStatus;
    name: string;
    progress: number;
    createdAt: number;
    payload: any;
    result?: any;
    error?: string;
    quality?: QualityReport;
}

class JobQueueService {
    private jobs: Job[] = [];
    private listeners: ((jobs: Job[]) => void)[] = [];

    public subscribe(callback: (jobs: Job[]) => void): () => void {
        this.listeners.push(callback);
        callback([...this.jobs]);
        return () => { this.listeners = this.listeners.filter(l => l !== callback); };
    }

    private notify() { this.listeners.forEach(l => l([...this.jobs])); }

    public getJobs(): Job[] {
        return [...this.jobs];
    }

    public addAudioJob(file: File, overrideBpm?: number, extras?: { genre?: MusicGenre | string; key?: string; scale?: string; mode?: 'MELODY_1_1' | 'FULL_BAND'; gridDiv?: number; snapToKey?: boolean }) {
        const pickError = describeAudioPickError(file);
        if (pickError) {
            throw new Error(pickError);
        }
        const job: Job = {
            id: `AUDIO-${Date.now()}`,
            type: 'AUDIO_REGRESSION',
            status: 'PENDING',
            name: `Audio to MIDI: ${file.name}`,
            progress: 0,
            createdAt: Date.now(),
            payload: { file, overrideBpm, genre: extras?.genre, key: extras?.key, scale: extras?.scale },
        };
        this.jobs.unshift(job);
        this.notify();
        this.processQueue();
        return job.id;
    }

    public addMidiJob(params: GenerationParams, channels: ChannelKey[]) {
        const job: Job = { id: `MIDI-${Date.now()}`, type: 'MIDI_GENERATION', status: 'PENDING', name: `Synthesizing Track`, progress: 0, createdAt: Date.now(), payload: { params, channels } };
        this.jobs.unshift(job);
        this.notify();
        this.processQueue();
        return job.id;
    }

    public addForensicStudyJob(url: string) {
        const job: Job = { 
            id: `STUDY-${Date.now()}`, 
            type: 'FORENSIC_STUDY', 
            status: 'PENDING', 
            name: `Forensic Study`, 
            progress: 0, 
            createdAt: Date.now(), 
            payload: { url } 
        };
        this.jobs.unshift(job);
        this.notify();
        this.processQueue();
        return job.id;
    }

    public addForensicJob(payload: any, isFile: boolean) {
        const job: Job = { 
            id: `FORENSIC-${Date.now()}`, 
            type: 'FORENSIC_ANALYSIS', 
            status: 'PENDING', 
            name: isFile ? `Forensic Audit: ${payload.name}` : `Forensic Audit: Bridge Object`, 
            progress: 0, 
            createdAt: Date.now(), 
            payload: { data: payload, isFile } 
        };
        this.jobs.unshift(job);
        this.notify();
        this.processQueue();
        return job.id;
    }

    public addMelodyJob(params: any) {
        const job: Job = { 
            id: `MELODY-${Date.now()}`, 
            type: 'MELODY_ARCHITECT', 
            status: 'PENDING', 
            name: `Architecting Melody`, 
            progress: 0, 
            createdAt: Date.now(), 
            payload: params 
        };
        this.jobs.unshift(job);
        this.notify();
        this.processQueue();
        return job.id;
    }

    public addRenderJob(file: File, profile: RenderProfile) {
        const job: Job = { 
            id: `RENDER-${Date.now()}`, 
            type: 'MIDI_RENDER', 
            status: 'PENDING', 
            name: `Rendering: ${file.name}`, 
            progress: 0, 
            createdAt: Date.now(), 
            payload: { file, profile } 
        };
        this.jobs.unshift(job);
        this.notify();
        this.processQueue();
        return job.id;
    }

    private async processQueue() {
        const next = this.jobs.find(j => j.status === 'PENDING');
        if (!next) return;

        next.status = 'PROCESSING';
        this.notify();

        try {
            if (next.type === 'AUDIO_REGRESSION') await this.runAudioJob(next);
            else if (next.type === 'MIDI_GENERATION') await this.runMidiJob(next);
            else if (next.type === 'FORENSIC_STUDY') await this.runForensicStudyJob(next);
            else if (next.type === 'FORENSIC_ANALYSIS') await this.runForensicJob(next);
            else if (next.type === 'MELODY_ARCHITECT') await this.runMelodyJob(next);
            else if (next.type === 'MIDI_RENDER') await this.runRenderJob(next);
            
            next.status = 'COMPLETED';
            next.progress = 100;
        } catch (e: any) {
            next.status = 'FAILED';
            next.error = e.message;
        } finally {
            this.notify();
            this.processQueue();
        }
    }

    private async runMidiJob(job: Job) {
        const { params, channels } = job.payload;
        job.progress = 25; this.notify();
        const res = await maestroService.generateGroove(params, params.trackLengthMinutes, channels);
        job.progress = 70; this.notify();
        const gated = inspectAndHealGroove(res, 'TRACK');
        job.quality = gated.report;
        job.result = gated.groove;
        job.name = `${gated.report.passed ? 'QA PASS' : 'QA FIX'} ${gated.report.score} · Track`;
    }

    private async runAudioJob(job: Job) {
        const file = job.payload.file as File;
        const ok = await decodeIfAudio(file);
        if (!ok) {
            throw new Error('לא הצלחנו לקרוא את הקובץ כשמע. בחרו MP3, WAV, M4A או AAC — לא MIDI.');
        }
        job.progress = 12;
        this.notify();

        const analysis = await analyzeSongToStems(file, (p) => {
            job.progress = Math.min(80, p);
            this.notify();
        }, {
            bpm: job.payload.overrideBpm,
            key: job.payload.key,
            scale: job.payload.scale,
        });

        job.progress = 86;
        this.notify();

        const trackName = file.name.replace(/\.[^.]+$/, '');
        const melodyOnly = (job.payload.mode || 'MELODY_1_1') === 'MELODY_1_1';

        const groove = melodyOnly
            ? arrangeMelodyOnly(analysis, {
                bpm: job.payload.overrideBpm || analysis.bpm,
                key: job.payload.key || analysis.key,
                scale: job.payload.scale || analysis.scale,
                trackName,
                gridDiv: job.payload.gridDiv ?? 4,
                snapToKey: !!job.payload.snapToKey,
            })
            : arrangeTranceFromAnalysis(analysis, {
                genre: job.payload.genre || MusicGenre.PSYTRANCE_FULLON,
                bpm: job.payload.overrideBpm || analysis.bpm,
                key: job.payload.key || analysis.key,
                scale: job.payload.scale || analysis.scale,
                trackName,
            });

        job.progress = 94;
        this.notify();
        const gated = inspectAndHealGroove(groove, melodyOnly ? 'MELODY_1_1' : 'AUDIO_TO_MIDI');
        job.quality = gated.report;
        job.result = gated.groove;
        const noteCount = ((gated.groove as any).ch4_leadA || []).length;
        job.name = melodyOnly
            ? `${gated.report.passed ? 'QA PASS' : 'QA FIX'} ${gated.report.score} · Melody ${noteCount} notes · ${gated.groove.bpm} BPM`
            : `${gated.report.passed ? 'QA PASS' : 'QA FIX'} ${gated.report.score} · ${gated.groove.bpm} BPM`;
    }

    private async runForensicStudyJob(job: Job) {
        job.progress = 20; this.notify();
        const result = await deconstructYoutubeLink(job.payload.url);
        job.result = result;
    }

    private async runForensicJob(job: Job) {
        job.progress = 30; this.notify();
        if (job.payload.isFile) {
            job.result = { corrected: [] }; 
        } else {
            const corrected = contextBridge.autoCorrect(job.payload.data);
            job.result = { corrected };
        }
    }

    private async runMelodyJob(job: Job) {
        job.progress = 30; this.notify();
        const params = job.payload;
        const notes = await generateDivineMelody(params);
        job.progress = 80; this.notify();
        
        const eliteObj = contextBridge.enrichMidi(
            notes, 
            params.genre, 
            params.mood, 
            params.role, 
            145, 
            { root: params.key, scale: params.scale }
        );
        job.result = eliteObj;
    }

    private async runRenderJob(job: Job) {
        const { file, profile } = job.payload;
        const rendered = await midiRendererService.renderToAudio(file, profile, (p) => {
            job.progress = Math.min(96, Math.round(p));
            this.notify();
        });
        job.quality = rendered.quality || await inspectAudioBlob(rendered.wav || rendered.blob);
        job.result = rendered.blob;
        job.payload = { ...job.payload, filename: rendered.filename, mime: rendered.mime, duration: rendered.duration, notes: rendered.notes };
        job.name = `${job.quality.passed ? 'QA PASS' : 'QA CHECK'} ${job.quality.score} · MP3`;
    }

    public clearCompleted() {
        this.jobs = this.jobs.filter(j => j.status !== 'COMPLETED' && j.status !== 'FAILED');
        this.notify();
    }

    public cancelJob(id: string) {
        const job = this.jobs.find(j => j.id === id);
        if (job) job.status = 'FAILED';
        this.notify();
    }
}

export const jobQueueService = new JobQueueService();
