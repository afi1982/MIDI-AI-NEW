
import { GrooveObject, GenerationParams, ChannelKey } from '../types';
import { generateTranceSequence, deconstructYoutubeLink, generateDivineMelody } from './geminiService';
import { maestroService, ELITE_16_CHANNELS } from './maestroService.ts';
import { analyzeAudioChunk, sliceAudio } from './audioAnalysisService';
import { forensicFixerService } from './forensicFixerService';
import { contextBridge } from './contextBridgeService';
import { midiRendererService, RenderProfile } from './midiRendererService';

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

    public addAudioJob(file: File, overrideBpm?: number) {
        const job: Job = { id: `AUDIO-${Date.now()}`, type: 'AUDIO_REGRESSION', status: 'PENDING', name: `Audio to MIDI: ${file.name}`, progress: 0, createdAt: Date.now(), payload: { file, overrideBpm } };
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
        // 1. Get raw patterns from AI
        const seed = await generateTranceSequence(params, channels);
        job.progress = 50; this.notify();
        
        // 2. Pass merged params (user choices + AI seed) to Maestro
        const combinedContext = { ...seed, ...params };
        
        let res = await maestroService.generateGroove(combinedContext, params.trackLengthMinutes, channels);
        job.result = await forensicFixerService.auditAndHeal(res);
    }

    private async runAudioJob(job: Job) {
        const CHUNK_LEN = 12; 
        
        // Phase 1: Slicing (0-30%)
        const slices = await sliceAudio(job.payload.file, CHUNK_LEN, (p) => {
            job.progress = p;
            this.notify();
        });

        const segments: GrooveObject[] = new Array(slices.length);
        
        // Phase 2: Analysis (30-100%)
        const batchSize = 3; 
        for (let i = 0; i < slices.length; i += batchSize) {
            const batch = slices.slice(i, i + batchSize).map((slice, idx) => {
                const realIdx = i + idx;
                return analyzeAudioChunk(slice.blob, realIdx, CHUNK_LEN, slice.isSilent, job.payload.overrideBpm).then(res => {
                    segments[realIdx] = res;
                    const completed = segments.filter(s => !!s).length;
                    // Map 0-100% of analysis to 30-100% of total progress
                    const analysisProgress = (completed / slices.length) * 70;
                    job.progress = Math.round(30 + analysisProgress);
                    this.notify();
                }).catch(err => {
                    console.error(`Batch error at index ${realIdx}:`, err);
                    segments[realIdx] = { id: `ERR-${realIdx}`, bpm: job.payload.overrideBpm || 140, key: "C", scale: "Chromatic", totalBars: 4 } as any;
                    const completed = segments.filter(s => !!s).length;
                    const analysisProgress = (completed / slices.length) * 70;
                    job.progress = Math.round(30 + analysisProgress);
                    this.notify();
                });
            });
            await Promise.all(batch);
        }

        const master: any = { ...segments[0], id: `RECON-${Date.now()}`, totalBars: segments.reduce((s, seg) => s + (seg.totalBars || 0), 0) };
        ELITE_16_CHANNELS.forEach(ch => {
            (master as any)[ch] = segments.flatMap(seg => (seg as any)[ch] || []);
        });
        job.result = master;
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
        const blob = await midiRendererService.renderToWav(file, profile, (p) => {
            job.progress = Math.round(p);
            this.notify();
        });
        job.result = blob;
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
