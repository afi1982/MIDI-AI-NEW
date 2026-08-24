import { composeSeededLoop, makeSession, emptyDest, writeStyleBar, applyPumpLock, bassOnKickCount } from '../services/styleSyncEngine';
import { theoryEngine } from '../services/theoryEngine';
import { ChannelKey, EnergyLevel, MusicGenre } from '../types';

const styles = [
  MusicGenre.GOA_TRANCE,
  MusicGenre.PSYTRANCE_FULLON,
  MusicGenre.PSYTRANCE_POWER,
  MusicGenre.MELODIC_TECHNO,
  MusicGenre.TECHNO_PEAK,
];

const PITCHED: ChannelKey[] = ['ch2_sub', 'ch3_midBass', 'ch4_leadA', 'ch5_leadB', 'ch6_arpA', 'ch7_arpB', 'ch14_acid', 'ch15_pad', 'ch16_synth'];
const midiOf = (n: { note: any }) => theoryEngine.getMidiNote(Array.isArray(n.note) ? n.note[0] : n.note);
const sig = (notes: { note: any; startTick?: number; durationTicks?: number }[]) =>
  notes.map((n) => `${n.note}@${n.startTick}:${n.durationTicks}`).join('|');

const seed = 777001;
const byStyle: Record<string, Record<string, ReturnType<typeof composeSeededLoop>>> = {};

for (const g of styles) {
  const session = makeSession(seed, g, 'D', 'Minor', true);
  const dest = emptyDest();
  const layers = new Set(Object.keys(dest) as ChannelKey[]);
  for (let bar = 0; bar < 8; bar++) writeStyleBar(session, bar, dest, layers, EnergyLevel.PEAK);
  applyPumpLock(dest, session, 0, 8);
  if (bassOnKickCount(dest, session, 8) > 0) throw new Error(`${g}: bass on kick`);
  byStyle[g] = dest as any;

  for (const ch of PITCHED) {
    const notes = dest[ch] || [];
    const off = notes.filter((n) => !theoryEngine.isNoteInScale(Array.isArray(n.note) ? n.note[0] : n.note, 'D', 'Minor'));
    if (off.length) throw new Error(`${g} ${ch}: ${off.length} notes out of D minor`);
  }

  const leads = dest.ch4_leadA.map(midiOf);
  if (g !== MusicGenre.TECHNO_PEAK && leads.some((m) => m < 58)) {
    throw new Error(`${g}: lead below register (${Math.min(...leads)})`);
  }
  const subs = dest.ch2_sub.map(midiOf);
  if (subs.some((m) => m > 52)) throw new Error(`${g}: sub too high`);
  const mids = dest.ch3_midBass.map(midiOf);
  if (mids.length && Math.min(...mids) <= Math.min(...subs)) throw new Error(`${g}: mid bass not above sub`);
}

const goa = byStyle[MusicGenre.GOA_TRANCE];
const full = byStyle[MusicGenre.PSYTRANCE_FULLON];
const power = byStyle[MusicGenre.PSYTRANCE_POWER];
const mel = byStyle[MusicGenre.MELODIC_TECHNO];
const tech = byStyle[MusicGenre.TECHNO_PEAK];

if (goa.ch8_snare.length) throw new Error('Goa should not have a backbeat snare');
if (full.ch9_clap.length) throw new Error('Full-On should not have house claps');
if (!tech.ch8_snare.length) throw new Error('Techno needs snare on 2 and 4');
if (!mel.ch8_snare.length) throw new Error('Melodic techno needs snare');
if (goa.ch12_hhClosed.length <= mel.ch12_hhClosed.length) throw new Error('Goa hats should be denser than melodic');
if (goa.ch14_acid.length <= tech.ch14_acid.length) throw new Error('Goa acid should be denser than techno');
if (sig(full.ch3_midBass) === sig(full.ch2_sub)) throw new Error('Mid bass is a clone of sub');
if (full.ch16_synth.length > 8) throw new Error('Full-On FX should be phrase-end only, not a grid');
if (mel.ch4_leadA.every((n) => (n.durationTicks || 0) < 400)) throw new Error('Melodic lead must hold long notes');

const channels: ChannelKey[] = ['ch1_kick', 'ch2_sub', 'ch3_midBass', 'ch4_leadA', 'ch12_hhClosed', 'ch14_acid', 'ch15_pad'];
for (const ch of channels) {
  const uniq = new Set(styles.map((g) => sig(byStyle[g][ch] || [])));
  if (uniq.size < 3) throw new Error(`${ch} only has ${uniq.size} identities across 5 styles`);
}

console.log({
  goa: Object.fromEntries(Object.entries(goa).map(([k, v]) => [k, (v as any).length])),
  fullonHats: full.ch12_hhClosed.length,
  melHats: mel.ch12_hhClosed.length,
  goaAcid: goa.ch14_acid.length,
  techAcid: tech.ch14_acid.length,
  fullFx: full.ch16_synth.length,
  powerClap: power.ch9_clap.length,
});
console.log('ALL-CHANNEL STYLE CHECK PASSED');
