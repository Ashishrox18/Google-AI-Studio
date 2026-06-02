/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useRef } from 'react';
import { TRACKS } from './data';
import { Track } from './types';
import { synthService } from './audio/SynthEngine';
import { SnakeGame } from './components/SnakeGame';
import { 
  Gamepad2, Music, Sparkles, Terminal, Activity, Disc,
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Radio, Award, Zap
} from 'lucide-react';

export default function App() {
  const [currentTrack, setCurrentTrack] = useState<Track>(TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeBeatIndex, setActiveBeatIndex] = useState<number>(0);
  const [lastBeatType, setLastBeatType] = useState<'kick' | 'bass' | 'lead' | 'snare' | null>(null);
  
  // Game state hoisted for Header & Bento Widgets
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  
  // Media playback controls
  const [volume, setVolume] = useState<number>(0.5);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [trackTime, setTrackTime] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Synchronise synthesiser beat indicators
  useEffect(() => {
    synthService.setOnBeat((beatIndex, beatType) => {
      setActiveBeatIndex(beatIndex);
      setLastBeatType(beatType);
    });
    
    return () => {
      synthService.setOnBeat(() => {});
    };
  }, []);

  // Synchronise Synth volume states
  useEffect(() => {
    synthService.setVolume(isMuted ? 0 : volume);
  }, [volume, isMuted]);

  // Timed layout increments tracking playback progression simulation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setTrackTime((t) => (t + 1) % 195); // track loops generally after ~3 mins
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Canvas visualizer logic inside the right Bento card
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderSpectrum = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Dark futuristic trace trails
      ctx.fillStyle = 'rgba(5, 5, 5, 0.28)';
      ctx.fillRect(0, 0, width, height);

      const frequencies = synthService.getByteFrequencyData();
      const numBars = 16;
      const barWidth = (width / numBars) - 2;

      let glowColor = 'rgb(6, 182, 212)'; // Default cyan
      if (currentTrack.accentColor === 'fuchsia') glowColor = 'rgb(240, 46, 170)';
      if (currentTrack.accentColor === 'emerald') glowColor = 'rgb(34, 197, 94)';

      for (let i = 0; i < numBars; i++) {
        const value = frequencies[Math.min(i * 3, frequencies.length - 1)] || 0;
        let barHeight = (value / 255) * height * 0.95;
        
        // Idle heartbeat wave if sound muted/paused
        if (!isPlaying) {
          barHeight = (Math.sin(Date.now() * 0.0035 + i * 0.6) + 1.2) * 6;
        }

        // Base slot tracks
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(i * (barWidth + 2), 0, barWidth, height);

        // Render bar glow
        ctx.fillStyle = glowColor;
        ctx.shadowBlur = isPlaying ? 12 : 2;
        ctx.shadowColor = glowColor;

        ctx.fillRect(
          i * (barWidth + 2),
          height - barHeight,
          barWidth,
          barHeight
        );
      }

      ctx.shadowBlur = 0;
      animationRef.current = requestAnimationFrame(renderSpectrum);
    };

    renderSpectrum();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentTrack, isPlaying]);

  // Audio handlers
  const handleTogglePlay = () => {
    if (isPlaying) {
      synthService.pauseTrack();
      setIsPlaying(false);
    } else {
      synthService.playTrack(currentTrack);
      setIsPlaying(true);
    }
  };

  const handleNextTrack = () => {
    const currentIdx = TRACKS.findIndex((t) => t.id === currentTrack.id);
    const nextIdx = (currentIdx + 1) % TRACKS.length;
    const nextTrack = TRACKS[nextIdx];
    setCurrentTrack(nextTrack);
    setTrackTime(0);
    if (isPlaying) {
      synthService.playTrack(nextTrack);
    }
  };

  const handlePrevTrack = () => {
    const currentIdx = TRACKS.findIndex((t) => t.id === currentTrack.id);
    const prevIdx = (currentIdx - 1 + TRACKS.length) % TRACKS.length;
    const prevTrack = TRACKS[prevIdx];
    setCurrentTrack(prevTrack);
    setTrackTime(0);
    if (isPlaying) {
      synthService.playTrack(prevTrack);
    }
  };

  const selectTrack = (track: Track) => {
    setCurrentTrack(track);
    setTrackTime(0);
    synthService.playTrack(track);
    setIsPlaying(true);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Color mappings
  const getGlowShadow = () => {
    if (currentTrack.accentColor === 'fuchsia') return 'shadow-[0_0_50px_rgba(240,46,170,0.12)] border-fuchsia-500/20';
    if (currentTrack.accentColor === 'cyan') return 'shadow-[0_0_50px_rgba(6,182,212,0.12)] border-cyan-500/20';
    return 'shadow-[0_0_50px_rgba(34,197,94,0.12)] border-emerald-500/20';
  };

  const getAccentText = () => {
    if (currentTrack.accentColor === 'fuchsia') return 'text-fuchsia-400';
    if (currentTrack.accentColor === 'cyan') return 'text-cyan-400';
    return 'text-emerald-400';
  };

  const getAccentBg = () => {
    if (currentTrack.accentColor === 'fuchsia') return 'bg-fuchsia-500';
    if (currentTrack.accentColor === 'cyan') return 'bg-cyan-500';
    return 'bg-emerald-500';
  };

  return (
    <div className={`min-h-screen bg-[#050505] text-white flex flex-col relative overflow-x-hidden selection:bg-zinc-800 transition-all duration-1000 ${getGlowShadow()}`}>
      
      {/* Decorative cyber grid lines */}
      <div className="absolute inset-0 bg-dot-lights opacity-[0.03] pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

      {/* Modern High-Contrast Header */}
      <header className="h-16 border-b border-white/10 px-8 flex items-center justify-between bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-cyan-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            <div className="w-3.5 h-3.5 border border-black/80 rounded bg-white animate-pulse"></div>
          </div>
          <span className="text-xl font-black tracking-tighter uppercase italic select-none">
            NEON<span className="text-cyan-400">SNAKE</span>
            <span className="text-[9px] font-mono font-bold tracking-widest pl-2 opacity-50 not-italic">V1.0</span>
          </span>
        </div>

        {/* Live Active Scores in Bento Header */}
        <div className="flex gap-8">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Current Score</span>
            <span className="text-2xl font-mono font-bold text-cyan-400 leading-none drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
              {score.toString().padStart(5, '0')}
            </span>
          </div>
          <div className="flex flex-col items-end border-l border-white/10 pl-6">
            <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">High Score</span>
            <span className="text-2xl font-mono font-bold text-fuchsia-500 leading-none drop-shadow-[0_0_8px_rgba(240,46,170,0.4)]">
              {highScore.toString().padStart(5, '0')}
            </span>
          </div>
        </div>
      </header>

      {/* PRIMARY BENTO GRID MAIN CONTENT AREA */}
      <main className="flex-1 p-6 grid grid-cols-12 gap-6 relative z-10 max-w-7xl mx-auto w-full items-stretch">
        
        {/* LEFT COLUMN: Track Selector & System HUD (Col span 3) */}
        <section className="col-span-12 lg:col-span-3 flex flex-col gap-6" id="bento-left">
          
          {/* Card A: Playlist Queue */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1 flex flex-col justify-between" id="bento-playlist">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">Now Playing Queue</h3>
                <span className="px-2 py-0.5 text-[9px] font-mono border border-white/10 rounded-full font-bold uppercase bg-white/5">
                  AI Syntheses
                </span>
              </div>
              
              <div className="space-y-2">
                {TRACKS.map((track) => {
                  const isActive = track.id === currentTrack.id;
                  return (
                    <button
                      key={track.id}
                      onClick={() => selectTrack(track)}
                      className={`w-full text-left p-3 border rounded-xl flex items-center gap-3 transition-all cursor-pointer group ${
                        isActive
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                          : 'bg-white/5 border-transparent text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {/* Animated spectrum or play sign beside lists */}
                      <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center shrink-0">
                        {isActive && isPlaying ? (
                          <div className="flex items-end gap-1 h-5 justify-center">
                            <div className="w-1 bg-cyan-400 animate-pulse h-3"></div>
                            <div className="w-1 bg-cyan-400 animate-pulse h-5" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-1 bg-cyan-400 animate-pulse h-2" style={{ animationDelay: '0.4s' }}></div>
                          </div>
                        ) : (
                          <Play className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400 fill-current' : 'text-white/30 group-hover:text-white'}`} />
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <p className={`text-sm font-bold truncate ${isActive ? 'text-cyan-400' : 'text-zinc-200'}`}>
                          {track.title}
                        </p>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider font-mono mt-0.5">
                          {track.bpm} BPM / {track.genre}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Micro tempo card section */}
            <div className="mt-6 border-t border-white/5 pt-4 flex items-center justify-between font-mono text-[10px] text-white/30">
              <span>TEMPO RHYTHM</span>
              <span className="text-white bg-white/5 px-2 py-0.5 rounded border border-white/10 font-bold">
                {currentTrack.rhythmStyle.toUpperCase()} SPEED
              </span>
            </div>
          </div>

          {/* Card B: Game Controller Details */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 h-36 flex flex-col justify-between" id="bento-controls">
            <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">System Controls</h3>
            <div className="text-[11px] text-white/40 font-mono space-y-1.5 leading-normal">
              <p className="flex items-center justify-between">
                <span>Navigate Grid</span>
                <span className="text-white/70">W, A, S, D / Arrows</span>
              </p>
              <p className="flex items-center justify-between">
                <span>Pause Session</span>
                <span className="text-white/70">SPACEBAR / HUD Button</span>
              </p>
              <p className="flex items-center justify-between">
                <span>Rhythm Drive</span>
                <span className="text-white/70">Song BPM Controls speed</span>
              </p>
            </div>
          </div>

        </section>

        {/* CENTER COLUMN: Interactive Game terminal (Col span 6) */}
        <section className="col-span-12 lg:col-span-6 flex flex-col" id="bento-center">
          <SnakeGame 
            currentTrack={currentTrack}
            isPlayingTrack={isPlaying}
            activeBeatIndex={activeBeatIndex}
            onScoreChange={setScore}
            onHighScoreChange={setHighScore}
          />
        </section>

        {/* RIGHT COLUMN: Live Spectrum Analyzer & Highscores (Col span 3) */}
        <section className="col-span-12 lg:col-span-3 flex flex-col gap-6" id="bento-right">
          
          {/* Card D: Live Spectrum Analyzer details */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1 flex flex-col justify-between" id="bento-spectrum">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">Spectrum Waves</h3>
              <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-mono">
                <Radio className={`w-3.5 h-3.5 ${isPlaying ? 'animate-pulse text-red-500' : ''}`} />
                <span>LIVE FEED</span>
              </div>
            </div>

            {/* Spectrum bar visualizer canvas output */}
            <div className="w-full h-36 bg-black rounded-xl border border-white/5 p-2 overflow-hidden flex flex-col justify-center relative mt-4">
              <canvas ref={canvasRef} width={220} height={130} className="w-full h-full block" />
            </div>

            <div className="mt-4 text-center">
              <p className="text-[10px] uppercase font-bold text-white/40 tracking-[0.2em] font-mono">
                Live Spectrum Analysis
              </p>
              <p className="text-[9px] text-zinc-500 font-mono mt-1">
                PROCEDURAL 16-BAND OSCILLATION DETECTED
              </p>
            </div>
          </div>

          {/* Card E: Global Leaderboard Rank Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1" id="bento-leaderboard">
            <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-4">Cyber Ranking</h3>
            <div className="space-y-3.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 italic">01.</span>
                  <span className="text-white font-medium">NEON_RUNNER</span>
                </div>
                <span className="text-zinc-400">14,200</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 italic">02.</span>
                  <span className="text-white/80">PIXEL_GHOST</span>
                </div>
                <span className="text-zinc-400">12,850</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-600 italic">03.</span>
                  <span className="text-white/60">VOID_WALKER</span>
                </div>
                <span className="text-zinc-500">11,900</span>
              </div>
              
              {/* Reactive user record showing active metrics */}
              <div className="border-t border-white/5 pt-3 mt-3 flex justify-between items-center text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className={`italic font-black ${getAccentText()}`}>YOU.</span>
                  <span className="text-white font-black truncate max-w-[80px]">RETRO_SYS</span>
                </div>
                <span className={`${getAccentText()} font-black`}>
                  {score.toString().padEnd(3).substring(0, 7)}
                </span>
              </div>
            </div>
          </div>

        </section>
      </main>

      {/* FULL WIDTH MEDIA DECK FOOTER CONTROLS */}
      <footer className="h-24 border-t border-white/10 bg-black/80 backdrop-blur-xl px-8 flex items-center justify-between sticky bottom-0 z-50">
        
        {/* Track thumbnail and descriptors on left section */}
        <div className="flex items-center gap-4 w-1/4 min-w-44">
          <div className={`w-12 h-12 bg-gradient-to-br ${
            currentTrack.accentColor === 'fuchsia' ? 'from-fuchsia-500 to-indigo-600' :
            currentTrack.accentColor === 'cyan' ? 'from-cyan-500 to-fuchsia-600' :
            'from-emerald-500 to-teal-700'
          } rounded-lg flex-shrink-0 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.05)]`}>
            <Disc className={`w-6 h-6 text-white ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white truncate">{currentTrack.title}</h4>
            <p className="text-xs text-white/40 truncate">{currentTrack.artist}</p>
          </div>
        </div>

        {/* Media Buttons Controls and Beat timeline in center section */}
        <div className="flex flex-col items-center gap-2 flex-1 max-w-lg">
          
          {/* Controls buttons */}
          <div className="flex items-center gap-6">
            <button 
              onClick={handlePrevTrack}
              className="text-white/40 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
              title="Previous Track"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button 
              onClick={handleTogglePlay}
              className="w-11 h-11 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current text-black" />
              ) : (
                <Play className="w-5 h-5 fill-current text-black ml-0.5" />
              )}
            </button>
            <button 
              onClick={handleNextTrack}
              className="text-white/40 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
              title="Next Track"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>

          {/* Timeline slider simulation */}
          <div className="w-full flex items-center gap-3">
            <span className="text-[10px] font-mono text-white/40">{formatTime(trackTime)}</span>
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden relative">
              <div 
                className={`h-full bg-gradient-to-r ${
                  currentTrack.accentColor === 'fuchsia' ? 'from-fuchsia-500 to-indigo-600' :
                  currentTrack.accentColor === 'cyan' ? 'from-cyan-500 to-indigo-500' :
                  'from-emerald-500 to-cyan-500'
                } transition-all duration-1000 shadow-[0_0_10px_rgba(34,197,94,0.5)]`}
                style={{ width: `${(trackTime / 195) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-white/40">{currentTrack.duration}</span>
          </div>

        </div>

        {/* Sequencer lights and volume adjustment on right section */}
        <div className="flex items-center justify-end gap-6 w-1/4 min-w-[180px]">
          
          {/* Note light pulses synced with beats */}
          <div className="hidden xl:flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1.5 px-2 font-mono text-[9px] text-white/40">
            <span className="text-[8px] uppercase select-none pr-1">Pulse:</span>
            {Array.from({ length: 4 }).map((_, b) => {
              const activeOct = activeBeatIndex % 4 === b;
              return (
                <div 
                  key={b}
                  className={`w-2 h-2 rounded-full transition-all duration-100 ${
                    activeOct && isPlaying
                      ? currentTrack.accentColor === 'fuchsia' ? 'bg-fuchsia-400 shadow-[0_0_8px_#f02eaa]' :
                        currentTrack.accentColor === 'cyan' ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' :
                        'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                      : 'bg-white/10'
                  }`}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={toggleMute}
              className="text-white/50 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                setIsMuted(false);
              }}
              className="w-20 sm:w-24 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
              title="Volume Slider"
            />
          </div>
        </div>

      </footer>

    </div>
  );
}
