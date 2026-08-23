import { composeSeededLoop } from '../services/loopGrooveEngine';

const sig = (notes: { note: any; startTick?: number }[]) =>
  notes.map((n) => `${n.note}@${n.startTick}`).join('|');

const seeds = [11, 99, 12345, 777777, 20260823, 42, 1001, 8888];
const leads = seeds.map((s) => sig(composeSeededLoop('ch4_leadA', 'F#', 'Phrygian', 'Full-On Psytrance', 'COMPLEX', s)));
const unique = new Set(leads);
if (unique.size < seeds.length - 1) {
  throw new Error(`Lead loops too similar: ${unique.size} unique / ${seeds.length}`);
}
const acids = seeds.map((s) => sig(composeSeededLoop('ch14_acid', 'F#', 'Phrygian', 'Full-On Psytrance', 'COMPLEX', s)));
if (new Set(acids).size < seeds.length - 1) {
  throw new Error(`Acid loops too similar: ${new Set(acids).size} unique / ${seeds.length}`);
}

const a = composeSeededLoop('ch4_leadA', 'F#', 'Phrygian', 'Full-On Psytrance', 'COMPLEX', 11);
const b = composeSeededLoop('ch4_leadA', 'F#', 'Phrygian', 'Full-On Psytrance', 'COMPLEX', 99);
const shared = a.filter((n) => b.some((m) => m.note === n.note && m.startTick === n.startTick)).length;
const overlap = shared / Math.max(1, Math.min(a.length, b.length));
if (overlap > 0.55) throw new Error(`Two random leads overlap ${Math.round(overlap * 100)}%`);

console.log({
  uniqueLeads: unique.size,
  uniqueAcids: new Set(acids).size,
  overlapPct: Math.round(overlap * 100),
  leadA: a.length,
  leadB: b.length,
});
console.log('LOOP VARIETY CHECK PASSED');
