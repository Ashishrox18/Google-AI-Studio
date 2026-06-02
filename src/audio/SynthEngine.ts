import { Track } from '../types';

export class SynthEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private timerId: number | null = null;
  private isPlaying: boolean = false;
  
  // Synthesizer State
  private bpm: number = 120;
  private currentTrack: Track | null = null;
  private nextNoteTime: number = 0.0;
  private currentBeat: number = 0; // 0 to 15 (16th notes pattern)
  private sequenceIntervalMs: number = 25.0; // checking interval
  private scheduleAheadTime: number = 0.1; // how far ahead to schedule audio

  // Track volume control
  private mainGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private volume: number = 0.5;

  // React Callbacks
  private onBeatCallback: ((beatIndex: number, beatType: 'kick' | 'bass' | 'lead' | 'snare') => void) | null = null;

  constructor() {
    // Lazy loaded - AudioContext requires user gesture
  }

  // Initialize Audio
  private initAudio() {
    if (this.ctx) return;
    
    // Create audio context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Create Analyser for reactive visuals
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.7;

    // Create Main volume block
    this.mainGain = this.ctx.createGain();
    this.mainGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    
    // Connect Main Gain -> Analyser -> Output
    this.mainGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Create a separate FX volume block
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    this.sfxGain.connect(this.ctx.destination);
  }

  public setOnBeat(callback: (beatIndex: number, beatType: 'kick' | 'bass' | 'lead' | 'snare') => void) {
    this.onBeatCallback = callback;
  }

  public setVolume(val: number) {
    this.volume = val;
    if (this.mainGain && this.ctx) {
      this.mainGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
    }
  }

  public playTrack(track: Track) {
    this.initAudio();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.currentTrack = track;
    this.bpm = track.bpm;
    
    if (this.isPlaying) {
      // Just update track properties
      return;
    }

    this.isPlaying = true;
    this.nextNoteTime = this.ctx.currentTime;
    this.currentBeat = 0;
    this.loop();
  }

  public pauseTrack() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public getByteFrequencyData(): Uint8Array {
    if (!this.analyser) {
      return new Uint8Array(64).fill(0);
    }
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  // Core Scheduling Loop
  private loop() {
    if (!this.isPlaying || !this.ctx || !this.currentTrack) return;

    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentBeat, this.nextNoteTime);
      this.advanceNote();
    }

    this.timerId = window.setTimeout(() => this.loop(), this.sequenceIntervalMs);
  }

  private advanceNote() {
    if (!this.ctx) return;
    
    // Seconds per beat (quarter note = 60 / BPM)
    // We are scheduling 16th notes, so divide by 4
    const secondsPerBeat = 60.0 / this.bpm;
    const secondsPer16th = secondsPerBeat / 4.0;
    
    this.nextNoteTime += secondsPer16th;
    
    // Cycle beat 0-15
    this.currentBeat = (this.currentBeat + 1) % 16;
  }

  // Synthesis of instruments based on beat
  private scheduleNote(beat: number, time: number) {
    if (!this.ctx || !this.currentTrack || !this.mainGain) return;

    const frequencies = this.getScaleFrequencies(this.currentTrack);
    const style = this.currentTrack.rhythmStyle;

    // --- 1. DRUMS INTERACTION ---
    // Kick drum: on beats 0, 4, 8, 12 (standard four-on-the-floor) and sometimes chill offsets
    let playedKick = false;
    if (style === 'driving' && (beat % 4 === 0)) {
      this.synthesizeKick(time);
      playedKick = true;
    } else if (style === 'chill' && (beat === 0 || beat === 8 || beat === 11)) {
      this.synthesizeKick(time);
      playedKick = true;
    } else if (style === 'ambient' && beat === 0) {
      this.synthesizeKick(time);
      playedKick = true;
    }

    // Snare / clap: beats 4, 12
    let playedSnare = false;
    if (style !== 'ambient' && (beat === 4 || beat === 12)) {
      this.synthesizeSnare(time);
      playedSnare = true;
    }

    // Hi-hat: 16th offbeating
    if (style === 'driving' && (beat % 2 === 1)) {
      this.synthesizeHihat(time);
    } else if (style === 'chill' && (beat % 4 === 2)) {
      this.synthesizeHihat(time);
    }

    // --- 2. BASSLINE ---
    // Rhythmic bass notes
    let playedBass = false;
    let bassBeatPattern = [0, 2, 4, 6, 8, 10, 12, 14]; // default driving
    if (style === 'chill') {
      bassBeatPattern = [0, 3, 6, 8, 11, 14];
    } else if (style === 'ambient') {
      bassBeatPattern = [0, 8];
    }

    if (bassBeatPattern.includes(beat)) {
      // Pick a raw root base note from scale frequencies
      const progressionIdx = Math.floor(beat / 4) % frequencies.length;
      const rootHz = frequencies[progressionIdx] / 2; // Bass is 1 octave lower
      this.synthesizeBass(rootHz, time, style === 'chill' ? 0.3 : style === 'ambient' ? 0.6 : 0.15);
      playedBass = true;
    }

    // --- 3. LEAD MELODY ARPEGGIATION ---
    let playedLead = false;
    let leadTrigger = false;
    if (style === 'driving') {
      // Driving leads trigger on offbeat 16ths
      leadTrigger = (beat % 2 === 1 && beat !== 7 && beat !== 15) || (beat === 4 || beat === 11);
    } else if (style === 'chill') {
      leadTrigger = (beat % 4 === 1 || beat % 4 === 3);
    } else { // ambient
      leadTrigger = (beat === 2 || beat === 6 || beat === 10 || beat === 14);
    }

    if (leadTrigger) {
      // Pattern algorithm to choose scale note
      const melodyPattern = [0, 2, 4, 3, 1, 4, 2, 0, 1, 3, 4, 2, 3, 1, 0, 4];
      const noteIdx = melodyPattern[(beat + (this.bpm % 7)) % melodyPattern.length] % frequencies.length;
      const noteHz = frequencies[noteIdx] * (Math.random() > 0.7 ? 2 : 1); // sometimes 1 octave higher
      
      this.synthesizeLead(noteHz, time, style === 'ambient' ? 0.6 : 0.2);
      playedLead = true;
    }

    // Emit event back to UI for visual sync
    if (this.onBeatCallback) {
      let type: 'kick' | 'bass' | 'lead' | 'snare' = 'lead';
      if (playedKick) type = 'kick';
      else if (playedSnare) type = 'snare';
      else if (playedBass) type = 'bass';
      
      // Let React update to sync visuals
      setTimeout(() => {
        if (this.isPlaying && this.onBeatCallback) {
          this.onBeatCallback(beat, type);
        }
      }, Math.max(0, (time - this.ctx!.currentTime) * 1000));
    }
  }

  // --- INSTRUMENT SYNTHESIS MATH ---

  private synthesizeKick(time: number) {
    if (!this.ctx || !this.mainGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.mainGain);

    // Dynamic pitch bend from 150Hz down to 0.01Hz fast
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.15);

    // Fast decay envelope
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    osc.start(time);
    osc.stop(time + 0.17);
  }

  private synthesizeSnare(time: number) {
    if (!this.ctx || !this.mainGain) return;

    // Snare contains a short snappy white noise burst filter
    const bufferSize = this.ctx.sampleRate * 0.15; // 0.15s of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;

    const gain = this.ctx.createGain();

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainGain);

    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    // Add a basic mid tone pop osc as underlying body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    oscGain.gain.setValueAtTime(0.2, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(oscGain);
    oscGain.connect(this.mainGain);

    noise.start(time);
    noise.stop(time + 0.16);
    osc.start(time);
    osc.stop(time + 0.11);
  }

  private synthesizeHihat(time: number) {
    if (!this.ctx || !this.mainGain) return;

    // Custom hi-hat is high pass filtered white noise
    const bufferSize = this.ctx.sampleRate * 0.04;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;

    const gain = this.ctx.createGain();

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainGain);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    source.start(time);
    source.stop(time + 0.04);
  }

  private synthesizeBass(frequency: number, time: number, duration: number = 0.15) {
    if (!this.ctx || !this.mainGain) return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, time);

    // Vintage retro lowpass filter decay sweep
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, time);
    filter.frequency.exponentialRampToValueAtTime(40, time + duration);

    gain.gain.setValueAtTime(0.35, time);
    gain.gain.linearRampToValueAtTime(0.2, time + duration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainGain);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  private synthesizeLead(frequency: number, time: number, duration: number = 0.25) {
    if (!this.ctx || !this.mainGain) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Detuned rich detuned lead (cyberpunk staple)
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(frequency - 2, time);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(frequency + 2, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, time);
    filter.frequency.exponentialRampToValueAtTime(100, time + duration);

    gain.gain.setValueAtTime(0.08, time);
    gain.gain.linearRampToValueAtTime(0.05, time + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainGain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration + 0.05);
    osc2.stop(time + duration + 0.05);
  }

  // --- LIVE FX TRIGGERS (COIN BEERS & EPIC CRASHES) ---

  // Custom sweet neon beep for food scoring
  public playFoodSFX() {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    
    // Quick rising pentatonic chirp
    osc.frequency.setValueAtTime(523.25, time); // C5
    osc.frequency.setValueAtTime(659.25, time + 0.04); // E5
    osc.frequency.setValueAtTime(783.99, time + 0.08); // G5 
    osc.frequency.setValueAtTime(1046.50, time + 0.12); // C6

    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + 0.27);
  }

  // Deep filtered vintage game over crash
  public playCrashSFX() {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const time = this.ctx.currentTime;
    
    // Lower frequency explosive noise
    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5s of rumble noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, time);
    filter.frequency.exponentialRampToValueAtTime(60, time + 0.45);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    // Deep synth oscillator body subdrop
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.linearRampToValueAtTime(40, time + 0.4);

    oscGain.gain.setValueAtTime(0.4, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);

    noise.start(time);
    noise.stop(time + 0.52);
    osc.start(time);
    osc.stop(time + 0.46);
  }

  // Helpers to resolve base frequencies based on minor scale pitches
  private getScaleFrequencies(track: Track): number[] {
    const scaleMap: Record<string, number> = {
      'C': 261.63, 'C#': 277.18, 'D': 293.66, 'Eb': 311.13, 'E': 329.63,
      'F': 349.23, 'F#': 369.99, 'G': 392.00, 'G#': 415.30, 'A': 440.00,
      'Bb': 466.16, 'B': 493.88
    };

    const frequencies: number[] = [];
    const baseFreqMultiplier = track.baseFreq / 261.63; // normalise around C4

    for (const note of track.scale) {
      if (scaleMap[note]) {
        frequencies.push(scaleMap[note] * baseFreqMultiplier);
      } else {
        frequencies.push(track.baseFreq);
      }
    }

    return frequencies;
  }
}

// Global Singleton for easy cross-component reference
export const synthService = new SynthEngine();
