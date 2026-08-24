import { composeProfessionalTrack } from '../services/trackComposer';
import { composeSeededLoop, makeSession, bassOnKickCount, emptyDest, writeStyleBar, applyPumpLock, styleOf } from '../services/styleSyncEngine';
import { EnergyLevel, MusicGenre } from '../types';

const styles = [
  MusicGenre.GOA_TRANCE,
  MusicGenre.PSYTRANCE_FULLON,
  MusicGenre.PSYTRANCE_POWER,
  MusicGenre.MELODIC_TECHNO,
  MusicGenre.TECHNO_PEAK,
];

const sig = (notes: { note: any; startTick?: number }[]) =>
  notes.map((n) => `${n.note}@${n.startTick}`).join('|');

const seed = 424242;
const bassSigs = styles.map((g) => sig(composeSeededLoop('ch2_sub', 'F#', 'Phrygian', g, 'COMPLEX', seed)));
if (new Set(bassSigs).size < styles.length) {
  throw new Error(`Bass patterns collide across styles: ${new Set(bassSigs).size}/${styles.length}`);
}

const kickSigs = styles.map((g) => sig(composeSeededLoop('ch1_kick', 'F#', 'Phrygian', g, 'COMPLEX', seed)));
if (new Set(kickSigs).size < 3) {
  throw new Error(`Kick patterns too similar across styles: ${new Set(kickSigs).size}`);
}

const leadCounts = Object.fromEntries(styles.map((g) => [g, composeSeededLoop('ch4_leadA', 'F#', 'Phrygian', g, 'COMPLEX', seed).length]));
if (leadCounts[MusicGenre.GOA_TRANCE] <= leadCounts[MusicGenre.TECHNO_PEAK]) {
  throw new Error(`Goa lead (${leadCounts[MusicGenre.GOA_TRANCE]}) should be denser than techno (${leadCounts[MusicGenre.TECHNO_PEAK]})`);
}
if (leadCounts[MusicGenre.MELODIC_TECHNO] >= leadCounts[MusicGenre.GOA_TRANCE] * 0.6) {
  throw new Error('Melodic techno lead should be much sparser than Goa');
}

for (const g of styles) {
  const session = makeSession(seed, g, 'F#', 'Phrygian', true);
  const dest = emptyDest();
  const layers = new Set(Object.keys(dest) as any);
  for (let bar = 0; bar < 4; bar++) writeStyleBar(session, bar, dest, layers, EnergyLevel.PEAK);
  applyPumpLock(dest, session, 0, 4);
  const collisions = bassOnKickCount(dest, session, 4);
  if (collisions > 0) throw new Error(`${g}: ${collisions} bass notes sit on the kick (pump broken)`);
  const offGrid = dest.ch4_leadA.filter((n) => ((n.startTick || 0) % 120) !== 0).length;
  if (offGrid) throw new Error(`${g}: lead not locked to 16th grid`);
}

const track = composeProfessionalTrack({ genre: MusicGenre.PSYTRANCE_FULLON, key: 'F#', scale: 'Phrygian', bpm: 145 }, 2, []);
const goa = composeProfessionalTrack({ genre: MusicGenre.GOA_TRANCE, key: 'F#', scale: 'Phrygian', bpm: 148 }, 2, []);
const techno = composeProfessionalTrack({ genre: MusicGenre.TECHNO_PEAK, key: 'F#', scale: 'Phrygian', bpm: 132 }, 2, []);
if (sig(track.ch2_sub.slice(0, 24)) === sig(techno.ch2_sub.slice(0, 24))) {
  throw new Error('Full-On and Techno tracks share the same bass');
}
if (goa.ch4_leadA.length <= techno.ch4_leadA.length) {
  throw new Error('Goa track lead is not denser than techno');
}
if (!track.ch1_kick.length || !track.ch2_sub.length || !track.ch4_leadA.length) {
  throw new Error('Track missing kick/bass/lead');
}

console.log({
  styles: styles.map(styleOf),
  leadCounts,
  uniqueBass: new Set(bassSigs).size,
  uniqueKick: new Set(kickSigs).size,
  trackLead: track.ch4_leadA.length,
  goaLead: goa.ch4_leadA.length,
  technoLead: techno.ch4_leadA.length,
});
console.log('CHANNEL SYNC + STYLE CHECK PASSED');
