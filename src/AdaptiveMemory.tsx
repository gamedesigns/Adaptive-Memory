import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, Volume2, VolumeX } from 'lucide-react';

type Difficulty = 'easy' | 'normal' | 'hard';
type GameState = 'waiting' | 'showing' | 'ready' | 'input' | 'failed';
type ColorType = 'bg-blue-500' | 'bg-red-500' | 'bg-green-500' | 'bg-yellow-500' | 'bg-purple-500';
type AnimationType = 'bounce' | 'scale';

interface DifficultySettings {
  patternLength: (level: number) => number;
  showTime: number;
  colors: ColorType[];
}

interface Difficulties {
  [key: string]: DifficultySettings;
}

const AdaptiveMemory: React.FC = () => {
  const [level, setLevel] = useState<number>(1);
  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(0);
  const [pattern, setPattern] = useState<ColorType[]>([]);
  const [displayIndex, setDisplayIndex] = useState<number>(-1);
  const [userPattern, setUserPattern] = useState<ColorType[]>([]);
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [activeColor, setActiveColor] = useState<ColorType | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [combo, setCombo] = useState<number>(0);
  const [lastComboLifeRegenerated, setLastComboLifeRegenerated] = useState<number>(0);
  const [animation, setAnimation] = useState<AnimationType>('bounce');
  const [lives, setLives] = useState<number>(3);
  const audioContext = useRef<AudioContext | null>(null);

  const difficulties: Difficulties = {
    easy: { 
      patternLength: (level) => Math.min(3 + Math.floor(level / 2), 8),
      showTime: 1000,
      colors: ['bg-blue-500', 'bg-red-500', 'bg-green-500']
    },
    normal: {
      patternLength: (level) => Math.min(4 + Math.floor(level / 2), 10),
      showTime: 800,
      colors: ['bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-yellow-500']
    },
    hard: {
      patternLength: (level) => Math.min(5 + Math.floor(level / 2), 12),
      showTime: 600,
      colors: ['bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500']
    }
  };

  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  useEffect(() => {
    audioContext.current = new AudioContext();
    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  const playSound = (frequency: number, duration: number = 200): void => {
    if (!soundEnabled || !audioContext.current) return;
    
    const oscillator = audioContext.current.createOscillator();
    const gain = audioContext.current.createGain();
    oscillator.connect(gain);
    gain.connect(audioContext.current.destination);
    oscillator.frequency.value = frequency;
    
    gain.gain.setValueAtTime(0.1, audioContext.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.current.currentTime + duration / 1000);
    
    oscillator.start(audioContext.current.currentTime);
    oscillator.stop(audioContext.current.currentTime + duration / 1000);
  };

  const getColorFrequency = (color: ColorType): number => ({
    'bg-blue-500': 262,
    'bg-red-500': 330,
    'bg-green-500': 392,
    'bg-yellow-500': 440,
    'bg-purple-500': 494
  }[color] || 350);

  const generatePattern = (): ColorType[] => {
    const length = difficulties[difficulty].patternLength(level);
    const colors = difficulties[difficulty].colors;
    return Array.from({ length }, () => 
      colors[Math.floor(Math.random() * colors.length)]
    ) as ColorType[];
  };

  useEffect(() => {
    if (gameState === 'showing' && displayIndex < pattern.length) {
      const timer = setTimeout(() => {
        setActiveColor(pattern[displayIndex]);
        playSound(getColorFrequency(pattern[displayIndex]));

        const hideTimer = setTimeout(() => {
          setActiveColor(null);
          setDisplayIndex(prev => prev + 1);
        }, difficulties[difficulty].showTime / 2);

        return () => clearTimeout(hideTimer);
      }, difficulties[difficulty].showTime);

      return () => clearTimeout(timer);
    }

    if (gameState === 'showing' && displayIndex >= pattern.length) {
      setActiveColor(null);
      setFeedback('Get Ready...');
      playSound(660, 500);

      const readyTimer = setTimeout(() => {
        setGameState('input');
        setFeedback('GO! Repeat the pattern!');
        playSound(880, 300);
      }, 1000);

      return () => clearTimeout(readyTimer);
    }
  }, [gameState, displayIndex, pattern]);

  const startRound = (): void => {
    const newPattern = generatePattern();
    setPattern(newPattern);
    setUserPattern([]);
    setGameState('showing');
    setDisplayIndex(0);
    setFeedback('Watch the pattern...');
  };

  const handleColorClick = (color: ColorType): void => {
    if (gameState !== 'input') return;

    setActiveColor(color);
    playSound(getColorFrequency(color));
    setTimeout(() => setActiveColor(null), 200);

    const newUserPattern = [...userPattern, color];
    setUserPattern(newUserPattern);

    if (color !== pattern[userPattern.length]) {
      playSound(100, 500);
      const newLives = lives - 1;
      setLives(newLives);
      
      if (newLives <= 0) {
        setGameState('failed');
        if (score > bestScore) {
          setBestScore(score);
        }
        setCombo(0);
        setFeedback(`Game Over! Final Score: ${score}${score > bestScore ? ' - New Best Score!' : ''}`);
      } else {
        setCombo(0);
        setFeedback(`Wrong pattern! ${newLives} lives remaining. Watch again...`);
        setTimeout(() => {
          setUserPattern([]);
          setDisplayIndex(0);
          setGameState('showing');
          setFeedback('Watch the pattern...');
        }, 1500);
      }
      return;
    }

    if (newUserPattern.length === pattern.length) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      
      const combosNeeded = 10 + Math.floor(level / 2) * 5;
      
      if (newCombo >= combosNeeded && newCombo > lastComboLifeRegenerated && lives < 3) {
        setLives(prev => Math.min(prev + 1, 3));
        setLastComboLifeRegenerated(newCombo);
        setFeedback(`Perfect! Life regenerated! (${lives + 1}/3)`);
        playSound(880, 1000);
      } else {
        const comboBonus = Math.floor(newCombo * 0.5 * difficulties[difficulty].patternLength(level));
        const levelScore = level * difficulties[difficulty].patternLength(level);
        setScore(prev => prev + levelScore + comboBonus);
        setLevel(prev => prev + 1);
        
        if (level > 5) {
          setAnimation(prev => prev === 'bounce' ? 'scale' : 'bounce');
        }
        
        setFeedback(`Correct! +${levelScore} points ${comboBonus > 0 ? `(+${comboBonus} combo bonus!)` : ''}`);
      }
      
      setTimeout(() => {
        startRound();
      }, 1500);
    }
  };

  const resetGame = (): void => {
    setLevel(1);
    setScore(0);
    setGameState('waiting');
    setPattern([]);
    setUserPattern([]);
    setFeedback('');
    setDisplayIndex(-1);
    setActiveColor(null);
    setCombo(0);
    setAnimation('bounce');
    setLives(3);
    setLastComboLifeRegenerated(0);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto p-6">
      <CardContent className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Adaptive Memory</h2>
            <div className="flex items-center space-x-4">
              <p className="text-gray-600">Level: {level} | Score: {score}</p>
              <div className="flex items-center space-x-1">
                {[...Array(3)].map((_, i) => (
                  <span
                    key={i}
                    className={`w-4 h-4 rounded-full ${
                      i < lives ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
              {combo > 1 && (
                <span className="text-orange-500 font-bold animate-pulse">
                  {combo}x Combo! ({Math.max(0, 10 + Math.floor(level / 2) * 5 - combo)} to life)
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1"
              >
                {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </Button>
            </div>
          </div>
          <div className="space-x-2">
            {Object.keys(difficulties).map((d) => (
              <Button
                key={d}
                variant={difficulty === d ? "default" : "outline"}
                onClick={() => {
                  setDifficulty(d as Difficulty);
                  resetGame();
                }}
                className="capitalize"
              >
                {d}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {difficulties[difficulty].colors.map((color, index) => (
            <button
              key={index}
              className={`h-24 rounded-lg transition-all duration-200 ${color}
                ${gameState === 'input' ? 'hover:opacity-80 cursor-pointer' : 'cursor-not-allowed'}
                ${activeColor === color ? `scale-110 ring-4 ring-white shadow-lg ${
                  level > 5 ? (animation === 'bounce' ? 'animate-bounce' : 'animate-pulse scale-125') 
                  : 'animate-bounce'
                }` : 'scale-100'}`}
              onClick={() => handleColorClick(color)}
              disabled={gameState !== 'input'}
            />
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex justify-center items-center h-12">
            <p className={`text-lg font-bold ${
              gameState === 'showing' ? 'text-blue-500 animate-pulse' :
              gameState === 'input' ? 'text-green-500 animate-bounce' :
              gameState === 'failed' ? 'text-red-500' : 'text-gray-500'
            }`}>
              {feedback}
            </p>
          </div>

          <div className="flex justify-center space-x-4">
            {gameState === 'waiting' && (
              <Button onClick={startRound} className="px-8">
                Start Game
              </Button>
            )}
            {gameState === 'failed' && (
              <Button onClick={resetGame} className="px-8">
                Play Again
              </Button>
            )}
          </div>

          <div className="flex justify-center">
            <div className="space-x-2">
              {pattern.map((_, index) => (
                <span
                  key={index}
                  className={`inline-block w-4 h-4 rounded-full transition-colors
                    ${index < userPattern.length ? 'bg-green-500' : 'bg-gray-300'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdaptiveMemory;