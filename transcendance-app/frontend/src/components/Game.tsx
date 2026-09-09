import React, { useEffect, useRef, useState } from 'react';
import gameBackground from '../assets/game-background.gif';

type GameProps = {
  onGameEnd: (won: boolean) => void;
};

const TARGET = 20;

const Game: React.FC<GameProps> = ({ onGameEnd }) => {
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [clicks, setClicks] = useState(0);
  const clicksRef = useRef(clicks);

  useEffect(() => {
    clicksRef.current = clicks;
  }, [clicks]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((seconds) => {
        if (seconds <= 1) {
          clearInterval(interval);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) {
      onGameEnd(clicksRef.current >= TARGET);
    }
  }, [secondsLeft, onGameEnd]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '2rem',
      fontFamily: 'Arial, sans-serif',
      backgroundImage: `url(${gameBackground})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      <h1>Game</h1>
      <p>{secondsLeft}</p>
      <p>Target: {TARGET}</p>
      <p>Clicks: {clicks}</p>
      <button onClick={() => setClicks((count) => count + 1)} style={{ fontSize: '1rem' }}>
        Click me
      </button>
      <button onClick={() => onGameEnd(false)} style={{ fontSize: '1rem' }}>
        Back
      </button>
    </div>
  );
};

export default Game;
