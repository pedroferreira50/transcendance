import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import type { LobbyState } from './Lobby';

type LobbySummary = {
  code: string;
  hostUsername: string;
  playerCount: number;
  inProgress: boolean;
};

type LobbySelectProps = {
  username: string;
  onBack: () => void;
  onLobbyJoined: (lobby: LobbyState) => void;
};

const LobbySelect: React.FC<LobbySelectProps> = ({ username, onBack, onLobbyJoined }) => {
  const [lobbies, setLobbies] = useState<LobbySummary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    socket.connect();
    socket.emit('lobbyList:subscribe');

    function handleJoined(lobby: LobbyState) {
      onLobbyJoined(lobby);
    }

    socket.on('lobbyList:update', setLobbies);
    socket.on('lobby:joined', handleJoined);
    socket.on('lobby:error', setError);

    return () => {
      socket.off('lobbyList:update', setLobbies);
      socket.off('lobby:joined', handleJoined);
      socket.off('lobby:error', setError);
    };
  }, [onLobbyJoined]);

  function handleBack() {
    socket.disconnect();
    onBack();
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      height: '100vh',
      fontSize: '2rem',
      fontFamily: 'Arial, sans-serif',
      gap: '1rem'
    }}>
      <h1>Multiplayer</h1>

      <button onClick={() => socket.emit('lobby:create', username)} style={{ fontSize: '1rem' }}>
        Create Lobby
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
        {lobbies.length === 0 && <p style={{ fontSize: '1rem' }}>No lobbies available</p>}

        {lobbies.map((lobby) => (
          <button
            key={lobby.code}
            onClick={() => socket.emit('lobby:join', { code: lobby.code, username })}
            disabled={lobby.inProgress || lobby.playerCount >= 8}
            style={{ fontSize: '1rem' }}
          >
            {lobby.hostUsername}'s lobby ({lobby.playerCount}/8){lobby.inProgress ? ' - in progress' : ''}
          </button>
        ))}
      </div>

      {error && <p style={{ fontSize: '1rem', color: 'red' }}>{error}</p>}

      <button onClick={handleBack} style={{ fontSize: '1rem' }}>
        Back
      </button>
    </div>
  );
};

export default LobbySelect;
