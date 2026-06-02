import { Track } from './types';

export const TRACKS: Track[] = [
  {
    id: 'track1',
    title: 'Neon Voyager',
    artist: 'AI Gen. Synth Engine',
    duration: '03:15',
    color: 'shadow-[0_0_20px_rgba(240,46,170,0.4)] border-fuchsia-500/50 text-fuchsia-400',
    accentColor: 'fuchsia',
    genre: 'Synthwave / Retro',
    bpm: 110,
    description: 'A pulsing retro journey with deep modulated synth basslines, upbeat 16th note arpeggios, and driving kick beats.',
    scale: ['D', 'F', 'G', 'A', 'C'], // D Minor Pentatonic
    baseFreq: 293.66, // D4
    rhythmStyle: 'driving'
  },
  {
    id: 'track2',
    title: 'Cyber Chase',
    artist: 'AI Gen. Synth Engine',
    duration: '02:45',
    color: 'shadow-[0_0_20px_rgba(6,182,212,0.4)] border-cyan-500/50 text-cyan-400',
    accentColor: 'cyan',
    genre: 'Cyberpunk Cyber',
    bpm: 130,
    description: 'An fast-paced, high-voltage soundtrack fueled by quick drum transitions and highly detuned saw leads. Ideal for speed rounds.',
    scale: ['C', 'Eb', 'F', 'G', 'Bb'], // C Minor Pentatonic
    baseFreq: 261.63, // C4
    rhythmStyle: 'driving'
  },
  {
    id: 'track3',
    title: 'Stardust Lounge',
    artist: 'AI Gen. Synth Engine',
    duration: '04:12',
    color: 'shadow-[0_0_20px_rgba(34,197,94,0.4)] border-emerald-500/50 text-emerald-400',
    accentColor: 'emerald',
    genre: 'Ambient Vapor',
    bpm: 95,
    description: 'A relaxed ambient soundscape with mellow chords, slow rhythmic lowpass pulses, and soothing retro soundwaves.',
    scale: ['A', 'C', 'D', 'E', 'G'], // A Minor Pentatonic
    baseFreq: 220.00, // A3
    rhythmStyle: 'chill'
  }
];
