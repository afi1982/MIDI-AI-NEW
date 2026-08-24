import { buildMidiReport, ENGINE_BUILD } from '../services/buildReportService';
import { composeProfessionalTrack } from '../services/trackComposer';
import { MusicGenre } from '../types';

const groove = composeProfessionalTrack({ genre: MusicGenre.PSYTRANCE_FULLON, key: 'F#', scale: 'Phrygian', bpm: 145 }, 2, []);
const text = buildMidiReport(groove, 'TRACK');
if (!text.includes('MIDI AI BUILD REPORT')) throw new Error('missing header');
if (!text.includes(ENGINE_BUILD)) throw new Error('missing engine id');
if (!text.includes('ch4_leadA')) throw new Error('missing lead channel');
if (!text.includes('PASTE THIS ENTIRE REPORT')) throw new Error('missing paste hint');
if (!text.includes('contour:')) throw new Error('missing lead contour');
console.log({ chars: text.length, engine: ENGINE_BUILD, leadLine: text.split('\n').find((l) => l.includes('LeadA')) });
console.log('BUILD REPORT CHECK PASSED');
