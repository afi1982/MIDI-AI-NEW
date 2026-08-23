import { ChannelKey, NoteEvent } from '../types';
import { audioService } from './audioService';

export const loopPreviewPlayer = {
  async unlock() {
    return audioService.unlock();
  },

  isUnlocked() {
    return audioService.isPlaying() || true;
  },

  contextState() {
    return audioService.isPlaying() ? 'running' : 'suspended';
  },

  stop() {
    audioService.stop();
  },

  async play(notes: NoteEvent[], bpm: number, channel: ChannelKey = 'ch4_leadA') {
    return audioService.playLoop(notes, bpm, channel);
  },
};
