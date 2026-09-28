import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import lobbyBackground from '../assets/lobby-background.gif';

export type MatchStart = {
  you: number;
  usernames: string[];
};

type LobbyPlayer = {
  id: string;
  username: string;
  ready: boolean;
};

export type LobbyState = {
  code: string;
  hostId: string;
  players: LobbyPlayer[];
};

type LobbyProps = {
  initialLobby: LobbyState;
  onBack: () => void;
  onMatchStart: (match: MatchStart) => void;
};

const Lobby: React.FC<LobbyProps> = ({ initialLobby, onBack, onMatchStart }) => {
  const [lobby, setLobby] = useState<LobbyState>(initialLobby);

  useEffect(() => {
    function handleKicked() {
      onBack();
    }

    socket.on('lobby:update', setLobby);
    socket.on('match:start', onMatchStart);
    socket.on('lobby:kicked', handleKicked);

    return () => {
      socket.off('lobby:update', setLobby);
      socket.off('match:start', onMatchStart);
      socket.off('lobby:kicked', handleKicked);
    };
  }, [onMatchStart, onBack]);

  function handleBack() {
    socket.emit('lobby:leave');
    onBack();
  }

  const isHost = lobby.hostId === socket.id;
  const allReady = lobby.players.length >= 2 && lobby.players.every((player) => player.ready);
  const me = lobby.players.find((player) => player.id === socket.id);

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
      <h1>Lobby: {lobby.code}</h1>

      <ul>
        {lobby.players.map((player) => (
          <li key={player.id} style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>
              {player.username}{player.id === lobby.hostId ? ' (Host)' : ''} - {player.ready ? 'Ready' : 'Not Ready'}
            </span>

            {isHost && player.id !== lobby.hostId && (
              <button
                onClick={() => socket.emit('lobby:kick', player.id)}
                style={{ fontSize: '0.8rem' }}
              >
                Kick
              </button>
            )}
          </li>
        ))}
      </ul>

      <button onClick={() => socket.emit('lobby:ready')} style={{ fontSize: '1rem' }}>
        {me?.ready ? 'Unready' : 'Ready'}
      </button>

      {isHost && (
        <button
          onClick={() => socket.emit('lobby:start')}
          disabled={!allReady}
          style={{ fontSize: '1rem' }}
        >
          Start Match
        </button>
      )}

      <button onClick={handleBack} style={{ fontSize: '1rem' }}>
        Back
      </button>
    </div>
  );
};

export default Lobby;
