import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import type { MatchStart } from './Lobby';
import gameBackground from '../assets/game-background.gif';

type MatchEnd = {
  player1Clicks: number;
  player2Clicks: number;
  winner: 0 | 1 | 2;
  multiplayerWins: number;
  multiplayerLosses: number;
};

type MultiplayerGameProps = {
  match: MatchStart;
  onBack: () => void;
  onResult: (multiplayerWins: number, multiplayerLosses: number) => void;
};

const MultiplayerGame: React.FC<MultiplayerGameProps> = ({ match, onBack, onResult }) => {
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [player1Clicks, setPlayer1Clicks] = useState(0);
  const [player2Clicks, setPlayer2Clicks] = useState(0);
  const [result, setResult] = useState<MatchEnd | null>(null);

  useEffect(() => {
    function handleUpdate({ player1Clicks, player2Clicks }: { player1Clicks: number; player2Clicks: number }) {
      setPlayer1Clicks(player1Clicks);
      setPlayer2Clicks(player2Clicks);
    }

    function handleEnd(matchEnd: MatchEnd) {
      setResult(matchEnd);
      onResult(matchEnd.multiplayerWins, matchEnd.multiplayerLosses);
    }

    socket.on('match:tick', setSecondsLeft);
    socket.on('match:update', handleUpdate);
    socket.on('match:end', handleEnd);

    return () => {
      socket.off('match:tick', setSecondsLeft);
      socket.off('match:update', handleUpdate);
      socket.off('match:end', handleEnd);
    };
  }, [onResult]);

  function handleBack() {
    socket.disconnect();
    onBack();
  }

  function renderResultText() {
    if (!result) {
      return null;
    }

    if (result.winner === 0) {
      return "It's a draw!";
    }

    return result.winner === match.playerNumber ? 'You win!' : 'You lose!';
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '2rem',
      fontFamily: 'Arial, sans-serif',
      gap: '1rem',
      backgroundImage: `url(${gameBackground})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      <h1>Multiplayer Game</h1>
      <p>{secondsLeft}</p>

      <div style={{ display: 'flex', gap: '3rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{match.player1Username}</span>
          <span>{player1Clicks}</span>
          <button
            onClick={() => socket.emit('match:click')}
            disabled={match.playerNumber !== 1 || !!result}
            style={{ fontSize: '1rem' }}
          >
            Click
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{match.player2Username}</span>
          <span>{player2Clicks}</span>
          <button
            onClick={() => socket.emit('match:click')}
            disabled={match.playerNumber !== 2 || !!result}
            style={{ fontSize: '1rem' }}
          >
            Click
          </button>
        </div>
      </div>

      {result && <p>{renderResultText()}</p>}

      <button onClick={handleBack} style={{ fontSize: '1rem' }}>
        Back
      </button>
    </div>
  );
};

export default MultiplayerGame;
