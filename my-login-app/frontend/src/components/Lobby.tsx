import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import lobbyBackground from '../assets/lobby-background.gif';

export type MatchStart = {
  playerNumber: 1 | 2;
  player1Username: string;
  player2Username: string;
};

type LobbyProps = {
  username: string;
  onBack: () => void;
  onMatchStart: (match: MatchStart) => void;
};

const Lobby: React.FC<LobbyProps> = ({ username, onBack, onMatchStart }) => {
  const [players, setPlayers] = useState<string[]>([]);

  useEffect(() => {
    socket.connect();
    socket.emit('lobby:join', username);

    socket.on('lobby:update', setPlayers);
    socket.on('match:start', onMatchStart);

    return () => {
      socket.off('lobby:update', setPlayers);
      socket.off('match:start', onMatchStart);
    };
  }, [username, onMatchStart]);

  function handleBack() {
    socket.disconnect();
    onBack();
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
      backgroundImage: `url(${lobbyBackground})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      <h1>Lobby</h1>

      <ul>
        {players.map((player, index) => (
          <li key={index} style={{ fontSize: '1.25rem' }}>{player}</li>
        ))}
      </ul>

      <button
        onClick={() => socket.emit('lobby:play')}
        disabled={players.length < 2}
        style={{ fontSize: '1rem' }}
      >
        Play
      </button>

      <button onClick={handleBack} style={{ fontSize: '1rem' }}>
        Back
      </button>
    </div>
  );
};

export default Lobby;
