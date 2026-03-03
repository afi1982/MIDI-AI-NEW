
export class AudioEditorService {
    private context: AudioContext | null = null;
    private buffer: AudioBuffer | null = null;
    private source: AudioBufferSourceNode | null = null;
    private startTime: number = 0;
    private playbackOffset: number = 0;
    public isPlaying: boolean = false;

    // Remove eager constructor logic
    constructor() {}

    private initContext() {
        if (!this.context) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.context = new AudioContextClass();
        }
    }

    async loadFile(file: File): Promise<void> {
        this.initContext();
        if (!this.context) return;
        const arrayBuffer = await file.arrayBuffer();
        this.buffer = await this.context.decodeAudioData(arrayBuffer);
    }

    play(offset: number = 0) {
        this.initContext();
        if (!this.buffer || !this.context) return;
        
        if (this.context.state === 'suspended') {
            this.context.resume();
        }

        this.stop();
        
        this.source = this.context.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.context.destination);
        
        // Offset is in seconds
        const startOffset = Math.max(0, offset);
        this.source.start(0, startOffset);
        
        this.startTime = this.context.currentTime - startOffset;
        this.playbackOffset = startOffset;
        this.isPlaying = true;
    }

    stop() {
        if (this.source) {
            try { this.source.stop(); } catch(e) {}
            this.source = null;
        }
        if (this.isPlaying && this.context) {
            this.playbackOffset = this.context.currentTime - this.startTime;
        }
        this.isPlaying = false;
    }

    getCurrentTime(): number {
        if (!this.context) return 0;
        if (!this.isPlaying) return this.playbackOffset;
        return this.context.currentTime - this.startTime;
    }

    getDuration(): number {
        return this.buffer?.duration || 0;
    }
}

export const audioEditorService = new AudioEditorService();
