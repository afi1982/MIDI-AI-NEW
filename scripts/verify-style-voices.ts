import { composeSeededLoop } from '../services/loopGrooveEngine';

const seed = 123456;
const goaLead = composeSeededLoop('ch4_leadA', 'F#', 'Phrygian', 'Goa Trance', 'COMPLEX', seed);
const techLead = composeSeededLoop('ch4_leadA', 'F#', 'Phrygian', 'Techno (Peak Time)', 'COMPLEX', seed);
const fullLead = composeSeededLoop('ch4_leadA', 'F#', 'Phrygian', 'Full-On Psytrance', 'COMPLEX', seed);
const goaAcid = composeSeededLoop('ch14_acid', 'F#', 'Phrygian', 'Goa Trance', 'COMPLEX', seed);
const techAcid = composeSeededLoop('ch14_acid', 'F#', 'Phrygian', 'Techno (Peak Time)', 'COMPLEX', seed);
const simpleLead = composeSeededLoop('ch4_leadA', 'F#', 'Phrygian', 'Goa Trance', 'SIMPLE', seed);

console.log({
  goaLead: goaLead.length,
  techLead: techLead.length,
  fullLead: fullLead.length,
  simpleLead: simpleLead.length,
  goaAcid: goaAcid.length,
  techAcid: techAcid.length,
});

if (goaLead.length <= techLead.length) throw new Error('Goa lead should be denser than techno');
if (goaAcid.length <= techAcid.length) throw new Error('Goa acid should be denser than techno');
if (goaLead.length <= simpleLead.length) throw new Error('COMPLEX Goa lead should be denser than SIMPLE');
if (JSON.stringify(goaLead) === JSON.stringify(techLead)) throw new Error('Lead patterns identical');
if (JSON.stringify(goaAcid) === JSON.stringify(techAcid)) throw new Error('Acid patterns identical');
if (JSON.stringify(goaLead) === JSON.stringify(fullLead)) throw new Error('Goa and Full-On leads identical');
console.log('STYLE VOICE CHECK PASSED');
