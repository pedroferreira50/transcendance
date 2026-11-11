import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { socket } from '../socket';
import { mapLabel } from '../game/maps';
import type { GameStart } from '../game/protocol';
import type { LobbyState } from './Lobby';
import Screen from './Screen';
import './LobbySelect.css';

type LobbySummary = {
  code: string;
  hostUsername: string;
  playerCount: number;
  seats: number;
  map: string; // the name of the map, or "random"
  inProgress: boolean;
};

type LobbySelectProps = {
  onBack: () => void;
  onCreate: () => void;
  onLobbyJoined: (lobby: LobbyState) => void;
  onWatch: (start: GameStart) => void;
};

const LobbySelect: React.FC<LobbySelectProps> = ({ onBack, onCreate, onLobbyJoined, onWatch }) => {
  const { t } = useTranslation();
  const [lobbies, setLobbies] = useState<LobbySummary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    socket.connect();
    socket.emit('lobbyList:subscribe');

    function handleJoined(lobby: LobbyState) {
      onLobbyJoined(lobby);
    }

    // socket.active: true = a temporary failure (the server is off...), the socket tries again by itself;
    // false = the server refused the connection, and error.message says why ("Not logged in.")
    function handleConnectError(error: Error) {
      let message = error.message;
      if (socket.active) {
        message = t('lobby.errors.connect');
      }
      setError(message);
    }

    // connected (again): the old error does not apply anymore
    function handleConnect() {
      setError('');
    }

    socket.on('lobbyList:update', setLobbies);
    socket.on('lobby:joined', handleJoined);
    socket.on('game:start', onWatch);
    socket.on('lobby:error', setError);
    socket.on('connect_error', handleConnectError);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('lobbyList:update', setLobbies);
      socket.off('lobby:joined', handleJoined);
      socket.off('game:start', onWatch);
      socket.off('lobby:error', setError);
      socket.off('connect_error', handleConnectError);
      socket.off('connect', handleConnect);
    };
  }, [onLobbyJoined, onWatch, t]);

  function handleBack() {
    socket.disconnect();
    onBack();
  }

  return (
    <Screen title={t('lobby.lobbies')} onBack={handleBack}>
      <div className="lobbies">
        {lobbies.length === 0 && <p className="lobbies-empty">{t('lobby.empty')}</p>}

        {lobbies.length > 0 && (
          <ul className="lobby-list">
            {lobbies.map((lobby) => (
              <li key={lobby.code} className="text-box lobby-row">
                <span className="lobby-host">{lobby.hostUsername}</span>
                <span className="lobby-map">{mapLabel(lobby.map)}</span>
                <span className="lobby-count">{lobby.playerCount}/{lobby.seats}</span>
                <LobbyAction
                  lobby={lobby}
                  onJoin={() => socket.emit('lobby:join', { code: lobby.code })}
                  onWatch={() => socket.emit('lobby:spectate', { code: lobby.code })}
                />
              </li>
            ))}
          </ul>
        )}

        <p className="form-message" role="status">{error}</p>

        <button className="sea-button" onClick={onCreate}>
          {t('lobby.create')}
        </button>
      </div>
    </Screen>
  );
};

// What the row offers: JOIN, WATCH (a match is running), or why it can not be joined
const LobbyAction: React.FC<{ lobby: LobbySummary; onJoin: () => void; onWatch: () => void }> = ({ lobby, onJoin, onWatch }) => {
  const { t } = useTranslation();

  if (lobby.inProgress)
    return (
      <button className="sea-button lobby-join" onClick={onWatch}>
        {t('lobby.watch')}
      </button>
    );
  if (lobby.playerCount >= lobby.seats)
    return <span className="lobby-state">{t('lobby.full')}</span>;
  return (
    <button className="sea-button lobby-join" onClick={onJoin}>
      {t('lobby.join')}
    </button>
  );
};

export default LobbySelect;
