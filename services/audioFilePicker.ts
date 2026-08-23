/** Phone file pickers treat MIDI as audio (MIME audio/midi). Never use accept="audio/*". */

export const PHONE_AUDIO_EXTENSIONS = [
  '.mp3', '.wav', '.wave', '.flac', '.m4a', '.aac', '.ogg', '.oga',
  '.opus', '.webm', '.mp4', '.3gp', '.amr', '.aiff', '.aif', '.wma',
];

const MIDI_EXTENSIONS = ['.mid', '.midi', '.kar'];
const MIDI_TYPES = new Set(['audio/midi', 'audio/mid', 'audio/x-midi', 'audio/x-mid']);

export const DESKTOP_AUDIO_ACCEPT = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/flac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/opus',
  'audio/webm',
  'audio/3gpp',
  'audio/amr',
  'video/mp4',
  'video/webm',
  ...PHONE_AUDIO_EXTENSIONS,
].join(',');

export function isPhoneFilePicker(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  return navigator.maxTouchPoints > 1 && window.matchMedia('(pointer: coarse)').matches;
}

export function isMidiFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (MIDI_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  return MIDI_TYPES.has((file.type || '').toLowerCase());
}

export function isAudioFile(file: File): boolean {
  if (isMidiFile(file)) return false;
  const name = file.name.toLowerCase();
  if (PHONE_AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('audio/')) return true;
  if (type.startsWith('video/')) return true;
  return false;
}

export function describeAudioPickError(file: File): string | null {
  if (isMidiFile(file)) {
    return 'בחרתם קובץ MIDI. בכלי Audio to MIDI צריך קובץ שמע: MP3, WAV, M4A או AAC.';
  }
  return null;
}

export const SONG_ACCEPT = '.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.mp4,.3gp,.webm';
export const ALL_FILES_ACCEPT = '*/*';

export function openNativeFilePicker(accept: string, onFile: (file: File) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = false;
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  const cleanup = () => {
    input.remove();
  };
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    cleanup();
    if (file) onFile(file);
  });
  document.body.appendChild(input);
  input.click();
}
