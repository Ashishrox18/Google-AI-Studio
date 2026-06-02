import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Coordinate, Direction, GameState, Track } from '../types';
import { synthService } from '../audio/SynthEngine';
import { 
  Play, RotateCcw, Award, Zap, Shield, KeyRound, 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, HelpCircle
} from 'lucide-react';

interface SnakeGameProps {
  currentTrack: Track;
  isPlayingTrack: boolean;
  activeBeatIndex: number;
  onScoreChange?: (score: number) => void;
  onHighScoreChange?: (highScore: number) => void;
}

const GRID_SIZE = 20;
const INITIAL_SPEED = 150; // default interval in ms

export const SnakeGame: React.FC<SnakeGameProps> = ({
  currentTrack,
  isPlayingTrack,
  activeBeatIndex,
  onScoreChange,
  onHighScoreChange,
}) => {
  // Game state
  const [snake, setSnake] = useState<Coordinate[]>([
    { x: 10, y: 10 },
    { x: 10, y: 11 },
    { x: 10, y: 12 },
  ]);
  const [direction, setDirection] = useState<Direction>('UP');
  const [food, setFood] = useState<Coordinate>({ x: 5, y: 5 });
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem('snake_neon_highscore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(INITIAL_SPEED);

  // Notify parent component of score fluctuations for Bento alignment metrics
  useEffect(() => {
    if (onScoreChange) {
      onScoreChange(score);
    }
  }, [score, onScoreChange]);

  useEffect(() => {
    if (onHighScoreChange) {
      onHighScoreChange(highScore);
    }
  }, [highScore, onHighScoreChange]);

  // Direction queue to prevent rapid double-taps causing self-collision
  const dirRef = useRef<Direction>('UP');
  
  // Calculate game speed based on Track BPM (BPM dictates the base pace of the game!)
  useEffect(() => {
    // 60000 ms in a minute. We scale the game ticks with standard music time
    // Fast music (130 BPM) -> faster snake (approx 110ms update)
    // Cool music (95 BPM) -> comfortable snake (approx 175ms update)
    const basePace = (60 / currentTrack.bpm) * 300; 
    // Speed increases slightly as score goes up
    const adjustedSpeed = Math.max(50, basePace - score * 1.5);
    setSpeed(adjustedSpeed);
  }, [currentTrack.bpm, score]);

  // Generator loop for scoring food coordinates
  const generateNewFood = useCallback((currentSnake: Coordinate[]): Coordinate => {
    let attempts = 0;
    while (attempts < 500) {
      const newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // Check if food coordinates land on the snake's body
      const hitsSnake = currentSnake.some(
        (segment) => segment.x === newFood.x && segment.y === newFood.y
      );
      if (!hitsSnake) {
        return newFood;
      }
      attempts++;
    }
    return { x: 3, y: 3 }; // fallback
  }, []);

  // Set initial food placement safely on launch
  useEffect(() => {
    setFood(generateNewFood(snake));
  }, []);

  // Update direction reference
  const handleDirectionChange = useCallback((newDir: Direction) => {
    const currentDir = dirRef.current;
    
    // Disallow 180-degree immediate turns
    if (newDir === 'UP' && currentDir === 'DOWN') return;
    if (newDir === 'DOWN' && currentDir === 'UP') return;
    if (newDir === 'LEFT' && currentDir === 'RIGHT') return;
    if (newDir === 'RIGHT' && currentDir === 'LEFT') return;

    dirRef.current = newDir;
    setDirection(newDir);
  }, []);

  // Listen to keyboard capture keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        handleDirectionChange('UP');
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        handleDirectionChange('DOWN');
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        handleDirectionChange('LEFT');
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        handleDirectionChange('RIGHT');
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDirectionChange, isPaused, isGameOver, gameStarted]);

  // Heartbeat game tick updates
  useEffect(() => {
    if (isPaused || isGameOver || !gameStarted) return;

    const gameTick = () => {
      setSnake((prevSnake) => {
        const head = { ...prevSnake[0] };
        const currentDir = dirRef.current;

        // Move head based on active direction
        switch (currentDir) {
          case 'UP': head.y -= 1; break;
          case 'DOWN': head.y += 1; break;
          case 'LEFT': head.x -= 1; break;
          case 'RIGHT': head.x += 1; break;
        }

        // 1. Boundary checking for crash collisions
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          handleGameOver();
          return prevSnake;
        }

        // 2. Self-collision segments checking
        const selfCollision = prevSnake.some(
          (segment) => segment.x === head.x && segment.y === head.y
        );
        if (selfCollision) {
          handleGameOver();
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        // 3. Check for food harvesting
        if (head.x === food.x && head.y === food.y) {
          // Play score chime sound effect synthetically
          synthService.playFoodSFX();
          
          // Increment score counters
          setScore((prevScore) => {
            const nextScore = prevScore + 10;
            if (nextScore > highScore) {
              setHighScore(nextScore);
              localStorage.setItem('snake_neon_highscore', nextScore.toString());
            }
            return nextScore;
          });

          // Re-generate next food spawn points
          setFood(generateNewFood(newSnake));
        } else {
          // Remove tail if didn't eat
          newSnake.pop();
        }

        return newSnake;
      });
    };

    const interval = setInterval(gameTick, speed);
    return () => clearInterval(interval);
  }, [snake, direction, food, isPaused, isGameOver, gameStarted, speed, generateNewFood]);

  const handleGameOver = () => {
    synthService.playCrashSFX();
    setIsGameOver(true);
    setIsPaused(true);
  };

  const togglePlayPause = () => {
    if (isGameOver) {
      resetGame();
      return;
    }
    if (!gameStarted) {
      setGameStarted(true);
    }
    setIsPaused((prev) => !prev);
  };

  const resetGame = () => {
    const initialSnake = [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 },
    ];
    setSnake(initialSnake);
    setDirection('UP');
    dirRef.current = 'UP';
    setFood(generateNewFood(initialSnake));
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setGameStarted(true);
  };

  // UI flashing helpers to trace beat pulses
  const getBeatPulsingBorder = () => {
    if (!isPlayingTrack) return 'border-zinc-800 shadow-[0_0_10px_rgba(39,39,42,0.1)]';

    const isHighlightBeat = activeBeatIndex % 4 === 0; // Trigger lights on quarterly kicks
    if (!isHighlightBeat) {
      return currentTrack.accentColor === 'fuchsia' ? 'border-fuchsia-950/60 shadow-[0_0_8px_rgba(240,46,170,0.05)]' :
             currentTrack.accentColor === 'cyan' ? 'border-cyan-950/60 shadow-[0_0_8px_rgba(6,182,212,0.05)]' :
             'border-emerald-950/60 shadow-[0_0_8px_rgba(34,197,94,0.05)]';
    }

    // High accent values
    return currentTrack.accentColor === 'fuchsia' ? 'border-fuchsia-500/80 shadow-[0_0_20px_rgba(240,46,170,0.35)]' :
           currentTrack.accentColor === 'cyan' ? 'border-cyan-500/80 shadow-[0_0_20px_rgba(6,182,212,0.35)]' :
           'border-emerald-500/80 shadow-[0_0_20px_rgba(34,197,94,0.35)]';
  };

  const getTrackThemeTextGlow = () => {
    return currentTrack.accentColor === 'fuchsia' ? 'text-fuchsia-400 drop-shadow-[0_0_6px_rgba(240,46,170,0.5)]' :
           currentTrack.accentColor === 'cyan' ? 'text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]' :
           'text-emerald-400 drop-shadow-[0_0_6px_rgba(34,197,94,0.5)]';
  };

  return (
    <div className="flex flex-col gap-5 p-5 rounded-3xl bg-zinc-950/40 backdrop-blur-md border border-white/10 shadow-2xl relative select-none overflow-hidden">
      {/* Decorative dot matrix background for arcade feel */}
      <div className="absolute inset-0 bg-dot-lights opacity-15 pointer-events-none" />
      
      {/* Upper score deck header */}
      <div className="grid grid-cols-3 items-center justify-between border-b border-zinc-800/80 pb-3 mt-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            Active Score
          </span>
          <span className="text-xl font-black font-mono tracking-tight text-white pl-0.5">{score}</span>
        </div>

        <div className="flex flex-col items-center justify-center">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">SPEED</span>
          <span className="px-2 py-0.5 mt-0.5 text-[9px] font-mono font-bold tracking-wider rounded-md border border-zinc-800 bg-zinc-950 text-amber-400">
            {Math.round(1000 / speed)} Ticks/S
          </span>
        </div>

        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1 justify-end">
            <Award className="w-3.5 h-3.5" />
            High Score
          </span>
          <span className="text-xl font-black font-mono tracking-tight text-amber-400 pr-0.5">{highScore}</span>
        </div>
      </div>

      {/* Primary Arcade Console Window */}
      <div className="relative flex items-center justify-center">
        {/* Border wrapper wraps grid perfectly */}
        <div className={`relative rounded-xl border bg-black p-1 transition-all duration-100 ${getBeatPulsingBorder()}`}>
          
          {/* Main Grid Game board */}
          <div className="grid grid-cols-20 gap-[1px] w-[280px] h-[280px] xs:w-[320px] xs:h-[320px] sm:w-[360px] sm:h-[360px] bg-zinc-950/90 rounded-lg relative overflow-hidden">
            {/* Background scanner line grid vectors */}
            <div className="absolute inset-0 bg-grid-lines pointer-events-none opacity-10" />

            {/* Static grid loop blocks */}
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
              const x = idx % GRID_SIZE;
              const y = Math.floor(idx / GRID_SIZE);

              // Check if segment coordinates overlap Snake body
              const isSnakeHead = snake[0].x === x && snake[0].y === y;
              const isSnakeBodyIdx = snake.findIndex((segment) => segment.x === x && segment.y === y);
              const isSnakeBody = isSnakeBodyIdx > 0;
              
              // Food overlap
              const isFood = food.x === x && food.y === y;

              // Compute neon classes
              let innerBg = 'bg-transparent';
              
              if (isSnakeHead) {
                // Head coordinates styling
                innerBg = currentTrack.accentColor === 'fuchsia' ? 'bg-fuchsia-400 shadow-[0_0_12px_#f02eaa]' :
                          currentTrack.accentColor === 'cyan' ? 'bg-cyan-400 shadow-[0_0_12px_#22d3ee]' :
                          'bg-emerald-400 shadow-[0_0_12px_#34d399]';
              } else if (isSnakeBody) {
                // Gradient depth across body segments
                const lengthRatio = 1 - isSnakeBodyIdx / snake.length;
                innerBg = currentTrack.accentColor === 'fuchsia' 
                  ? `bg-fuchsia-600 shadow-[0_0_8px_rgba(240,46,170,0.4)]`
                  : currentTrack.accentColor === 'cyan'
                  ? `bg-cyan-600 shadow-[0_0_8px_rgba(6,182,212,0.4)]`
                  : `bg-emerald-600 shadow-[0_0_8px_rgba(34,197,94,0.4)]`;
              } else if (isFood) {
                // Glow pulsate apple food items
                const subBeat = activeBeatIndex % 2 === 0;
                innerBg = subBeat
                  ? 'bg-amber-400 shadow-[0_0_14px_#f59e0b] animate-pulse scale-105'
                  : 'bg-yellow-500 shadow-[0_0_8px_#eab308]';
              }

              return (
                <div
                  key={idx}
                  className={`w-full h-full rounded-[2px] transition-all duration-75 ${innerBg}`}
                />
              );
            })}
          </div>

          {/* Interactive HUD Screens overlays (Pause, Begin, Game Over screens) */}
          {(!gameStarted || isPaused || isGameOver) && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-center p-6 gap-4 z-10 transition-all">
              {isGameOver ? (
                <>
                  <div className="flex flex-col gap-1 items-center">
                    <span className="px-3 py-1 text-[10px] font-bold font-mono uppercase bg-red-950/80 border border-red-500/50 text-red-400 rounded shadow-[0_0_10px_rgba(239,68,68,0.2)] animate-pulse">
                      COLLISION REGISTERED
                    </span>
                    <h2 className="text-3xl font-black text-red-500 tracking-tight mt-2 select-none">GAME OVER</h2>
                  </div>
                  <div className="text-zinc-400 text-xs font-mono">
                    <p>Score Secured: <span className="text-white font-bold">{score}</span></p>
                    <p className="mt-1">Active Groove: <span className={getTrackThemeTextGlow()}>{currentTrack.title}</span></p>
                  </div>
                  <button
                    onClick={resetGame}
                    className={`mt-2 px-5 py-2.5 rounded-xl border font-bold text-sm tracking-wide shadow-lg flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95 bg-zinc-950 text-white ${
                      currentTrack.accentColor === 'fuchsia' ? 'border-fuchsia-500 hover:shadow-[0_0_15px_rgba(240,46,170,0.3)]' :
                      currentTrack.accentColor === 'cyan' ? 'border-cyan-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]' :
                      'border-emerald-500 hover:shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                    }`}
                  >
                    <RotateCcw className="w-4 h-4" />
                    RESTART ARCADE
                  </button>
                </>
              ) : !gameStarted ? (
                <>
                  <div className="flex flex-col gap-1 items-center">
                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-full animate-bounce">
                      <Zap className={`w-8 h-8 ${getTrackThemeTextGlow()}`} />
                    </div>
                    <h2 className="text-2xl font-extrabold text-white tracking-tight mt-2 select-none">NEON COOP MATRIX</h2>
                    <p className="text-zinc-400 text-[11px] leading-relaxed max-w-xs mt-1">
                      Play retro snake directly linked to procedural beats. The background melody controls the movement rhythm speed!
                    </p>
                  </div>
                  <button
                    onClick={togglePlayPause}
                    className={`mt-2 px-6 py-3 rounded-xl border font-bold text-sm tracking-wide text-white cursor-pointer transition-all hover:scale-105 active:scale-95 bg-zinc-950 flex items-center gap-2 ${
                      currentTrack.accentColor === 'fuchsia' ? 'border-fuchsia-500 hover:shadow-[0_0_15px_rgba(240,46,170,0.3)]' :
                      currentTrack.accentColor === 'cyan' ? 'border-cyan-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]' :
                      'border-emerald-500 hover:shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                    }`}
                  >
                    <Play className="w-4.5 h-4 fill-current text-white" />
                    INITIALIZE GAME
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight select-none">GAME PAUSED</h2>
                  <p className="text-zinc-400 text-xs font-mono leading-relaxed max-w-xs select-none">
                    Session preserved. Press <span className="text-zinc-200 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">SPACEBAR</span> or click below to resume.
                  </p>
                  <button
                    onClick={togglePlayPause}
                    className={`px-5 py-2.5 rounded-xl border font-bold text-sm tracking-wide text-white cursor-pointer transition-all hover:scale-105 active:scale-95 bg-zinc-950 flex items-center gap-2 ${
                      currentTrack.accentColor === 'fuchsia' ? 'border-fuchsia-500 hover:shadow-[0_0_15px_rgba(240,46,170,0.3)]' :
                      currentTrack.accentColor === 'cyan' ? 'border-cyan-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]' :
                      'border-emerald-500 hover:shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    RESUME MATRICES
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile-focused Virtuous D-Pad Joystick Overlay */}
      <div className="flex flex-col items-center justify-center gap-1 mt-1">
        <div className="flex justify-center w-full">
          <button
            onClick={() => handleDirectionChange('UP')}
            className={`p-3 rounded-xl border bg-zinc-950 hover:bg-zinc-900 transition-all duration-100 max-w-12 text-zinc-400 hover:text-white cursor-pointer ${
              direction === 'UP' ? 'border-amber-500/50 scale-102 text-amber-400' : 'border-zinc-800'
            }`}
            title="Move Up"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex justify-center gap-4 w-full">
          <button
            onClick={() => handleDirectionChange('LEFT')}
            className={`p-3 rounded-xl border bg-zinc-950 hover:bg-zinc-900 transition-all duration-100 max-w-12 text-zinc-400 hover:text-white cursor-pointer ${
              direction === 'LEFT' ? 'border-amber-500/50 scale-102 text-amber-400' : 'border-zinc-800'
            }`}
            title="Move Left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={togglePlayPause}
            className="px-4 py-2 font-mono font-bold text-xs rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all cursor-pointer min-w-24 uppercase"
          >
            {isPaused || isGameOver ? 'Resume' : 'Pause'}
          </button>

          <button
            onClick={() => handleDirectionChange('RIGHT')}
            className={`p-3 rounded-xl border bg-zinc-950 hover:bg-zinc-900 transition-all duration-100 max-w-12 text-zinc-400 hover:text-white cursor-pointer ${
              direction === 'RIGHT' ? 'border-amber-500/50 scale-102 text-amber-400' : 'border-zinc-800'
            }`}
            title="Move Right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center w-full">
          <button
            onClick={() => handleDirectionChange('DOWN')}
            className={`p-3 rounded-xl border bg-zinc-950 hover:bg-zinc-900 transition-all duration-100 max-w-12 text-zinc-400 hover:text-white cursor-pointer ${
              direction === 'DOWN' ? 'border-amber-500/50 scale-102 text-amber-400' : 'border-zinc-800'
            }`}
            title="Move Down"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Arcade Instructions panel */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-3 mt-1 text-center flex items-center justify-center gap-2">
        <HelpCircle className="w-4 h-4 text-zinc-500 shrink-0" />
        <p className="text-[10px] font-mono text-zinc-400 leading-normal">
          USE WASD, ARROW KEYS OR THE VIRTUAL D-PAD. PRESS SPACEBAR TO PAUSE.
        </p>
      </div>

    </div>
  );
};
