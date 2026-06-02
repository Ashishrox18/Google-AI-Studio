import React, { useEffect, useRef, useState } from 'react';
import { Track } from '../types';
import { TRACKS } from '../data';
import { synthService } from '../audio/SynthEngine';
import { Play, Pause, SkipForward, SkipBack, Volume2, Music, Disc, Radio } from 'lucide-react';

interface MusicPlayerProps {
  currentTrack: Track;
  isPlaying: boolean;
  onTrackChange: (track: Track) => void;
  onPlayPauseToggle: (playState: boolean) => void;
  activeBeatIndex: number;
  lastBeatType: 'kick' | 'bass' | 'lead' | 'snare' | null;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  currentTrack,
  isPlaying,
  onTrackChange,
  onPlayPauseToggle,
  activeBeatIndex,
  lastBeatType,
}) => {
  const [volume, setVolume] = useState<number>(0.5);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Synchronise Synth volume state
  useEffect(() => {
    synthService.setVolume(volume);
  }, [volume]);

  // Handle Play/Pause toggling internally or via props
  const handleTogglePlay = () => {
    if (isPlaying) {
      synthService.pauseTrack();
      onPlayPauseToggle(false);
    } else {
      synthService.playTrack(currentTrack);
      onPlayPauseToggle(true);
    }
  };

  const handleNextTrack = () => {
    const currentIdx = TRACKS.findIndex((t) => t.id === currentTrack.id);
    const nextIdx = (currentIdx + 1) % TRACKS.length;
    const nextTrack = TRACKS[nextIdx];
    
    onTrackChange(nextTrack);
    if (isPlaying) {
      synthService.playTrack(nextTrack);
    }
  };

  const handlePrevTrack = () => {
    const currentIdx = TRACKS.findIndex((t) => t.id === currentTrack.id);
    const prevIdx = (currentIdx - 1 + TRACKS.length) % TRACKS.length;
    const prevTrack = TRACKS[prevIdx];
    
    onTrackChange(prevTrack);
    if (isPlaying) {
      synthService.playTrack(prevTrack);
    }
  };

  const selectTrack = (track: Track) => {
    onTrackChange(track);
    if (isPlaying) {
      synthService.playTrack(track);
    } else {
      synthService.playTrack(track);
      onPlayPauseToggle(true);
    }
  };

  // Live Canvas Visualizer rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderVisuals = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Subtle translucent background clearing for sweet motion tail trace
      ctx.fillStyle = 'rgba(9, 9, 11, 0.25)';
      ctx.fillRect(0, 0, width, height);

      // Get live frequencies from Synth engine
      const frequencies = synthService.getByteFrequencyData();
      const numBars = 24;
      const barWidth = (width / numBars) - 2;

      // Glow accent color from current track
      let glowColor = 'rgb(240, 46, 170)'; // pink
      if (currentTrack.accentColor === 'cyan') glowColor = 'rgb(6, 182, 212)';
      if (currentTrack.accentColor === 'emerald') glowColor = 'rgb(34, 197, 94)';

      // Draw frequency visual spectrum bars
      for (let i = 0; i < numBars; i++) {
        // Average audio bin calculation
        const dataVal = frequencies[Math.min(i * 2, frequencies.length - 1)] || 0;
        
        // Scale bar height to visual container
        // If not playing, draw an ambient slow noise wave
        let barHeight = (dataVal / 255) * height * 0.9;
        if (!isPlaying) {
          barHeight = (Math.sin(Date.now() * 0.003 + i * 0.5) + 1.2) * 4;
        }

        // Draw background tracks for glowing slots (vacuum tube meter vibes)
        ctx.fillStyle = 'rgba(39, 39, 42, 0.3)';
        ctx.fillRect(i * (barWidth + 2), 0, barWidth, height);

        // Highlight bar color
        ctx.fillStyle = glowColor;
        ctx.shadowBlur = isPlaying ? 10 : 0;
        ctx.shadowColor = glowColor;

        // Draw actual spectrum bars rising from the bottom
        ctx.fillRect(
          i * (barWidth + 2),
          height - barHeight,
          barWidth,
          barHeight
        );
      }

      // Reset shadows
      ctx.shadowBlur = 0;

      // Request next frame
      animationRef.current = requestAnimationFrame(renderVisuals);
    };

    renderVisuals();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentTrack, isPlaying]);

  return (
    <div className="flex flex-col gap-5 p-5 rounded-2xl bg-zinc-900/95 border border-zinc-800 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Visual neon ambient light leaks */}
      <div 
        className={`absolute -top-24 -left-24 w-48 h-48 rounded-full filter blur-3xl opacity-20 pointer-events-none transition-all duration-705 ${
          currentTrack.accentColor === 'fuchsia' ? 'bg-fuchsia-500' :
          currentTrack.accentColor === 'cyan' ? 'bg-cyan-500' : 'bg-emerald-500'
        }`}
      />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-2">
          <Disc className={`w-4 h-4 text-zinc-400 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
          Procedural Sound System
        </h3>
        <span className={`px-2 py-0.5 text-[10px] font-mono border rounded-full font-bold uppercase ${
          currentTrack.accentColor === 'fuchsia' ? 'border-fuchsia-500/30 text-fuchsia-400 bg-fuchsia-500/10' :
          currentTrack.accentColor === 'cyan' ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10' :
          'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
        }`}>
          {currentTrack.genre}
        </span>
      </div>

      {/* Album cover / Spectrum screen */}
      <div className="relative">
        <div className="w-full h-32 rounded-xl bg-black border border-zinc-800/80 p-2 overflow-hidden flex flex-col justify-between">
          <canvas ref={canvasRef} width={380} height={120} className="w-full h-full block rounded" />
        </div>
      </div>

      {/* Song details */}
      <div className="text-center py-2 relative">
        <h2 className={`text-xl font-bold tracking-tight select-none transition-colors duration-500 leading-tight ${
          currentTrack.accentColor === 'fuchsia' ? 'text-fuchsia-400 drop-shadow-[0_0_10px_rgba(240,46,170,0.3)]' :
          currentTrack.accentColor === 'cyan' ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]' :
          'text-emerald-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]'
        }`}>
          {currentTrack.title}
        </h2>
        <p className="text-xs text-zinc-400 mt-1 font-mono">{currentTrack.artist}</p>
        <div className="flex items-center justify-center gap-4 mt-2 text-[11px] font-mono text-zinc-500">
          <span>TEMPO: <span className="text-zinc-300 font-bold">{currentTrack.bpm} BPM</span></span>
          <span className="w-1 h-1 rounded-full bg-zinc-700" />
          <span>LENGTH: <span className="text-zinc-300">{currentTrack.duration}</span></span>
        </div>
      </div>

      {/* Core Player controls */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={handlePrevTrack}
            className="p-2.5 rounded-full border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:bg-zinc-800/50 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg"
            title="Previous Track"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={handleTogglePlay}
            className={`p-4 rounded-full border shadow-[0_0_15px_rgba(255,255,255,0.05)] transition-all duration-300 cursor-pointer flex items-center justify-center text-white scale-110 active:scale-95 hover:scale-115 ${
              isPlaying 
                ? 'bg-zinc-100 border-zinc-100 text-black hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]' 
                : currentTrack.accentColor === 'fuchsia' ? 'bg-fuchsia-600/20 border-fuchsia-500 hover:bg-fuchsia-600/35 hover:shadow-[0_0_20px_rgba(240,46,170,0.4)]'
                : currentTrack.accentColor === 'cyan' ? 'bg-cyan-600/20 border-cyan-500 hover:bg-cyan-600/35 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                : 'bg-emerald-600/20 border-emerald-500 hover:bg-emerald-600/35 hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]'
            }`}
            title={isPlaying ? 'Pause Track' : 'Play Track'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current text-black" />
            ) : (
              <Play className="w-5 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={handleNextTrack}
            className="p-2.5 rounded-full border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:bg-zinc-800/50 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg"
            title="Next Track"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
        </div>

        {/* Dynamic Beat Sequencer Indicator bar */}
        <div className="bg-black/40 border border-zinc-800/50 rounded-lg p-2 flex flex-col gap-1.5 font-mono text-[10px]">
          <div className="flex items-center justify-between text-zinc-400">
            <span>RHYTHM SEQUENCE</span>
            <div className="flex items-center gap-1">
              <Radio className={`w-3.5 h-3.5 text-zinc-400 ${isPlaying ? 'animate-pulse text-red-500' : ''}`} />
              <span className="text-zinc-500 uppercase">{currentTrack.rhythmStyle} mode</span>
            </div>
          </div>
          
          {/* Note lights */}
          <div className="grid grid-cols-16 gap-0.5 mt-1">
            {Array.from({ length: 16 }).map((_, idx) => {
              const isCurrent = isPlaying && activeBeatIndex === idx;
              let highlightBg = 'bg-zinc-800 border-zinc-700/50';

              if (isCurrent) {
                if (lastBeatType === 'kick') highlightBg = 'bg-red-500 shadow-[0_0_8px_#ef4444] border-red-400';
                else if (lastBeatType === 'snare') highlightBg = 'bg-amber-400 shadow-[0_0_8px_#f59e0b] border-amber-300';
                else if (lastBeatType === 'bass') highlightBg = 'bg-sky-400 shadow-[0_0_8px_#38bdf8] border-sky-300';
                else highlightBg = 'bg-fuchsia-500 shadow-[0_0_8px_#d946ef] border-fuchsia-400';
              } else if (idx % 4 === 0) {
                // Kick grid accents
                highlightBg = 'bg-zinc-800 border border-zinc-700/80';
              } else {
                highlightBg = 'bg-zinc-900 border border-zinc-800';
              }

              return (
                <div
                  key={idx}
                  className={`h-4 rounded-sm transition-all duration-75 ${highlightBg}`}
                />
              );
            })}
          </div>
        </div>

        {/* Volume controller */}
        <div className="flex items-center gap-3 bg-zinc-950/40 p-2 border border-zinc-850 rounded-xl mt-1">
          <Volume2 className="w-4 h-4 text-zinc-500" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className={`w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-current ${
              currentTrack.accentColor === 'fuchsia' ? 'text-fuchsia-500' :
              currentTrack.accentColor === 'cyan' ? 'text-cyan-500' : 'text-emerald-500'
            }`}
          />
          <span className="text-[10px] font-mono text-zinc-400 w-8 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      {/* Playlist List */}
      <div className="mt-3 border-t border-zinc-800 pt-4 flex flex-col gap-2">
        <h4 className="text-[11px] font-mono tracking-wider text-zinc-500 uppercase flex items-center gap-1.5 mb-1">
          <Music className="w-3.5 h-3.5" />
          Generative Synthesizer Tracks
        </h4>

        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
          {TRACKS.map((track) => {
            const isActive = track.id === currentTrack.id;
            return (
              <button
                key={track.id}
                onClick={() => selectTrack(track)}
                className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition-all duration-200 group cursor-pointer ${
                  isActive
                    ? track.accentColor === 'fuchsia' ? 'bg-fuchsia-500/10 border-fuchsia-500/40 text-fuchsia-300' :
                      track.accentColor === 'cyan' ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300' :
                      'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-950/20 border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    isActive
                      ? track.accentColor === 'fuchsia' ? 'bg-fuchsia-400 animate-ping' :
                        track.accentColor === 'cyan' ? 'bg-cyan-400 animate-ping' :
                        'bg-emerald-400 animate-ping'
                      : 'bg-zinc-700'
                  }`} />
                  <div>
                    <p className="text-xs font-semibold leading-none">{track.title}</p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{track.bpm} BPM • {track.rhythmStyle} rhythm</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                  <span>{track.duration}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
