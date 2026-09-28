import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import type { MatchStart } from './Lobby';
import gameBackground from '../assets/poker_table.png';

const Avatar: React.FC<{ name: string }> = ({ name }) => (
  <div style={{
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: '#333',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    fontSize: '0.9rem',
    padding: '0.25rem',
    boxSizing: 'border-box',
    overflowWrap: 'break-word'
  }}>
    {name}
  </div>
);

// Each entry is one seat's position as a percentage of the table container
// (see the 70vmin x 70vmin div below) - 0% is the left/top edge, 100% is the
// right/bottom edge, 50% is the center. Seat index N always renders here,
// no matter how many players are in the match. Edit these numbers to line
// each seat up with a chair on the table image, then reload to check.
const SEAT_POSITIONS = [
  { left: 15, top: 100 },   // seat 0 - top center
  { left: 85, top: 100 }, // seat 1 - top right
  { left: 145, top: 70 }, // seat 2 - right
  { left: 145, top: 10 },   // seat 3 - bottom right
  { left: 85, top: -15 }, // seat 4 - bottom, right of center
  { left: 15, top: -15 }, // seat 5 - bottom, left of center
  { left: -45, top: 70 },   // seat 6 - bottom left
  { left: -45, top: 10 }, // seat 7 - left
];

type MatchEnd = {
  clicks: number[];
  winnerIndex: number;
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
  const [clicks, setClicks] = useState<number[]>(match.usernames.map(() => 0));
  const [result, setResult] = useState<MatchEnd | null>(null);

  useEffect(() => {
    function handleUpdate({ clicks }: { clicks: number[] }) {
      setClicks(clicks);
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

    if (result.winnerIndex === -1) {
      return "It's a draw!";
    }

    return result.winnerIndex === match.you ? 'You win!' : 'You lose!';
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      height: '100vh',
      fontSize: '2rem',
      fontFamily: 'Arial, sans-serif',
      gap: '1rem',
      backgroundImage: `url(${gameBackground})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      boxSizing: 'border-box',
      padding: '1rem'
    }}>
      <h1>.title.</h1>
      <p>{secondsLeft}</p>

      <div style={{ position: 'relative', width: '70vmin', height: '70vmin', flexGrow: 1 }}>
        {match.usernames.map((username, index) => {
          const { left, top } = SEAT_POSITIONS[index];

          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: `${left}%`,
                top: `${top}%`,
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Avatar name={username} />
              <span style={{ fontSize: '1.25rem' }}>{clicks[index]}</span>
              <button
                onClick={() => socket.emit('match:click')}
                disabled={index !== match.you || !!result}
                style={{ fontSize: '1rem' }}
              >
                Click
              </button>
            </div>
          );
        })}
      </div>

      {result && <p>{renderResultText()}</p>}

      <button onClick={handleBack} style={{ fontSize: '1rem' }}>
        Back
      </button>
    </div>
  );
};

export default MultiplayerGame;
