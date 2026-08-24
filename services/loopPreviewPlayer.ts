import { ChannelKey, NoteEvent } from '../types';
import { audioService } from './audioService';

export const loopPreviewPlayer = {
  arm() {
    return audioService.arm();
  },

  async unlock() {
    audioService.arm();
    return audioService.unlock();
  },

  isUnlocked() {
    return true;
  },

  isPlaying() {
    return audioService.isPlaying() && audioService.getMode() === 'loop';
  },

  contextState() {
    return audioService.isPlaying() ? 'running' : 'suspended';
  },

  stop() {
    audioService.stop();
  },

  async play(notes: NoteEvent[], bpm: number, channel: ChannelKey = 'ch4_leadA', genre?: string) {
    return audioService.playLoop(notes, bpm, channel, genre);
  },
};
