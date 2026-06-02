export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string; // MM:SS display
  color: string;    // CSS glow class color or theme name
  accentColor: string; // hexa or color name like 'fuchsia'
  genre: string;
  bpm: number;
  description: string;
  // Parameters for procedural music synthesizer
  scale: string[]; // e.g. ["C", "Eb", "F", "G", "Bb"]
  baseFreq: number; // e.g. 55 or 110 (Hz)
  rhythmStyle: 'driving' | 'chill' | 'ambient';
}

export interface GameState {
  score: number;
  highScore: number;
  snake: Coordinate[];
  food: Coordinate;
  direction: Direction;
  isGameOver: boolean;
  isPaused: boolean;
  speed: number; // current update tick in ms
  gameStarted: boolean;
  level: number;
}

export interface Coordinate {
  x: number;
  y: number;
}

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
