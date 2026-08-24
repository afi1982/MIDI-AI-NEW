import { Midi } from '@tonejs/midi';
import { Mp3Encoder } from '@breezystack/lamejs';

const midi = new Midi();
midi.header.setTempo(145);
const kick = midi.addTrack();
kick.name = '01 Kick';
kick.channel = 9;
kick.addNote({ midi: 36, time: 0, duration: 0.2, velocity: 1 });
kick.addNote({ midi: 36, time: 0, duration: 0.2, velocity: 0.8 });
kick.addNote({ midi: 36, time: 0.413, duration: 0.2, velocity: 1 });
const lead = midi.addTrack();
lead.name = '04 Lead A';
lead.addNote({ midi: 69, time: 0, duration: 0.4, velocity: 0.9 });
lead.addNote({ midi: 72, time: 0, duration: 0.4, velocity: 0.7 });
const bytes = midi.toArray();
if (!bytes.length) throw new Error('midi empty');

const n = 1152 * 8;
const left = new Float32Array(n);
const right = new Float32Array(n);
for (let i = 0; i < n; i++) {
  const s = Math.sin((i / 44100) * 220 * Math.PI * 2) * 0.4;
  left[i] = s;
  right[i] = s * 0.8;
}
const enc = new Mp3Encoder(2, 44100, 192);
const to16 = (src: Float32Array, from: number) => {
  const out = new Int16Array(1152);
  for (let i = 0; i < 1152; i++) out[i] = (src[from + i] || 0) * 0x7fff;
  return out;
};
const parts: Uint8Array[] = [];
for (let i = 0; i < n; i += 1152) {
  const buf = enc.encodeBuffer(to16(left, i), to16(right, i));
  if (buf.length) parts.push(buf);
}
const last = enc.flush();
if (last.length) parts.push(last);
const total = parts.reduce((s, p) => s + p.length, 0);
if (total < 200) throw new Error('mp3 too small');
const head = parts[0];
const b0 = head[0] & 0xff;
const isMp3 = b0 === 0xff || (b0 === 0x49 && (head[1] & 0xff) === 0x44);
if (!isMp3) throw new Error('not an mp3 header: ' + Array.from(head.slice(0, 4)).join(','));
console.log({ midiBytes: bytes.length, mp3Bytes: total, header: Array.from(head.slice(0, 4)), sameTimeNotes: 2 });
console.log('MP3 RENDER CHECK PASSED');
