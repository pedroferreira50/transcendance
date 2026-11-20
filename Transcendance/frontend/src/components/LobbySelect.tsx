import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { socket } from '../socket';
import { mapLabel } from '../game/maps';
import type { GameStart } from '../game/protocol';
import type { LobbyState } from './Lobby';
import Screen from './Screen';

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
      <div className="flex w-[min(100%,44rem)] flex-1 flex-col items-center justify-center gap-screen">
        {lobbies.length === 0 && <p className="m-0 text-message">{t('lobby.empty')}</p>}

        {lobbies.length > 0 && (
          // many lobbies: the list scrolls and the CREATE button stays on the screen
          <ul className="m-0 flex max-h-[50vh] w-full flex-col gap-[0.6rem] overflow-y-auto p-0">
            {lobbies.map((lobby) => (
              // host | map | 2/4 | JOIN. minmax(0,1fr): the host column can get narrower than the name, so a long name ends with "..."
              // On phones 2 columns: host | 2/4 over map | JOIN (the count goes up to the first line: col-start-2 row-start-1)
              <li key={lobby.code} className="text-box grid grid-cols-[minmax(0,1fr)_auto_auto_7em] items-center gap-4 phone:grid-cols-[minmax(0,1fr)_auto] phone:gap-x-2 phone:gap-y-[0.4rem]">
                <span className="truncate">{lobby.hostUsername}</span>
                <Cell className="w-[5.5em] phone:w-auto phone:text-left">{mapLabel(lobby.map)}</Cell>
                <Cell className="w-[2.2em] phone:col-start-2 phone:row-start-1 phone:justify-self-end">{lobby.playerCount}/{lobby.seats}</Cell>
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

// The map, the count and FULL of a row. The map and the count get the same width in every row,
// so the columns stay in line ("MEDIUM 1" is the longest name)
const Cell: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <span className={`text-center font-button text-[1.4em] text-sea-light ${className}`}>{children}</span>
);

// What the row offers: JOIN, WATCH (a match is running), or why it can not be joined
const LobbyAction: React.FC<{ lobby: LobbySummary; onJoin: () => void; onWatch: () => void }> = ({ lobby, onJoin, onWatch }) => {
  const { t } = useTranslation();

  if (lobby.inProgress)
    return (
      <button className="sea-button text-button-small" onClick={onWatch}>
        {t('lobby.watch')}
      </button>
    );
  if (lobby.playerCount >= lobby.seats)
    return <Cell>{t('lobby.full')}</Cell>;
  return (
    <button className="sea-button text-button-small" onClick={onJoin}>
      {t('lobby.join')}
    </button>
  );
};

export default LobbySelect;
