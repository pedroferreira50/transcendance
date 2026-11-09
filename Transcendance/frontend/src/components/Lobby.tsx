import React, { useEffect, useState } from 'react';
import { useTranslation } from "react-i18next";
import { socket } from '../socket';
import { mapLabel, type PlayerCount } from '../game/maps';
import type { Character, DynamicState, GameStart } from '../game/protocol';
import GameScreen from './GameScreen';
import MapSelect from './MapSelect';
import Players from './Players';
import Screen from './Screen';
import Winner from './Winner';
import './Lobby.css';

type LobbyPlayer = {
  id: string;
  username: string;
  character: Character | null; // null: no fish chosen yet
  ready: boolean;
};

export type LobbyState = {
  code: string;
  hostId: string;
  seats: number;
  map: string; // the name of the map, or "random"
  players: LobbyPlayer[];
};

type LobbyProps = {
  initialLobby: LobbyState;
  onBack: () => void;
};

const FISH: Character[] = ['goldfish', 'betta', 'angler', 'puffer'];

// The SETTINGS of the host: closed, choosing the players, or choosing the map for that number
type SettingsStep = 'closed' | 'players' | PlayerCount;

const Lobby: React.FC<LobbyProps> = ({ initialLobby, onBack }) => {
  const { t } = useTranslation();
  const [lobby, setLobby] = useState<LobbyState>(initialLobby);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<SettingsStep>('closed');
  // the match of this lobby (game:start), or null while in the lobby
  const [match, setMatch] = useState<GameStart | null>(null);
  // the last state of the match that just ended (the WINNER screen), or null
  const [result, setResult] = useState<DynamicState | null>(null);

  useEffect(() => {
    function handleKicked() {
      onBack();
    }

    socket.on('lobby:update', setLobby);
    socket.on('lobby:error', setMessage);
    socket.on('game:start', setMatch);
    socket.on('lobby:kicked', handleKicked);

    return () => {
      socket.off('lobby:update', setLobby);
      socket.off('lobby:error', setMessage);
      socket.off('game:start', setMatch);
      socket.off('lobby:kicked', handleKicked);
    };
  }, [onBack]);

  // every click asks the server something: the old message does not apply anymore
  function send(event: string, data?: unknown) {
    setMessage('');
    socket.emit(event, data);
  }

  function handleBack() {
    socket.emit('lobby:leave');
    onBack();
  }

  const isHost = lobby.hostId === socket.id;
  const allReady = lobby.players.length === lobby.seats && lobby.players.every((player) => player.ready);
  const me = lobby.players.find((player) => player.id === socket.id);

  // the match is over (final = game:end) or I left it (final = null: straight back to the lobby)
  function handleMatchEnd(final: DynamicState | null) {
    setMatch(null);
    setResult(final);
  }

  // the match, like the SETTINGS, opens inside the lobby: this component stays open behind it,
  // so the lobby:update that arrive during the match (and with the game:end) are not lost
  if (match) {
    return <GameScreen mode="online" start={match} onEnd={handleMatchEnd} />;
  }
  if (result) {
    return <Winner final={result} onBack={() => setResult(null)} onExit={handleBack} />;
  }

  // the SETTINGS use the same screens as creating a lobby; this component stays open
  // behind them, so the lobby:update of the others keep arriving
  if (settings === 'players') {
    return (
      <Players
        min={lobby.players.length}
        onChoose={setSettings}
        onBack={() => setSettings('closed')}
      />
    );
  }
  if (settings !== 'closed') {
    return (
      <MapSelect
        players={settings}
        onChoose={(map) => {
          send('lobby:settings', { seats: settings, map });
          setSettings('closed');
        }}
        onBack={() => setSettings('players')}
      />
    );
  }

  // one seat for each player of the match: who sits there, or nobody yet
  const seats: (LobbyPlayer | null)[] = [];
  for (let i = 0; i < lobby.seats; i++) {
    if (i < lobby.players.length) {
      seats.push(lobby.players[i]);
    } else {
      seats.push(null);
    }
  }

  let mapName = mapLabel(lobby.map);
  if (lobby.map === 'random') {
    mapName = t('lobby.random');
  }

  let readyLabel = t('lobby.ready');
  if (me && me.ready) {
    readyLabel = t('lobby.notReady');
  }

  return (
    <Screen title={t('lobby.title')} onBack={handleBack}>
      <div className="lobby-room">
        <div className="lobby-info">
          <span className="text-box lobby-settings">
            {mapName} · {t('lobby.players', { count: lobby.seats })}
          </span>
          {isHost && (
            <button className="sea-button secondary" onClick={() => setSettings('players')}>
              SETTINGS
            </button>
          )}
        </div>

        <ul className="seats">
          {seats.map((player, i) => {
            let seatKey = `empty-${i}`;
            if (player !== null) {
              seatKey = player.id;
            }
            let onKick: (() => void) | null = null;
            if (isHost && player !== null && player.id !== socket.id) {
              onKick = () => send('lobby:kick', player.id);
            }
            return (
              <Seat
                key={seatKey}
                player={player}
                isHost={player !== null && player.id === lobby.hostId}
                onKick={onKick}
              />
            );
          })}
        </ul>

        <div className="fish-choice" role="group" aria-label={t('lobby.chooseFish')}>
          {FISH.map((fish) => {
            const owner = lobby.players.find((player) => player.character === fish);
			let fishClass = 'fish-option';
            if (owner && owner === me) {
              fishClass = 'fish-option mine';
            }
            return (
              <button
                key={fish}
                className={fishClass}
                disabled={owner !== undefined && owner !== me}
                onClick={() => send('lobby:character', fish)}
                aria-label={fish}
              >
                <img src={`/art/fish/${fish}.webp`} alt="" />
                <span className='fish-name'>{fish}</span>
              </button>
            );
          })}
        </div>

        <div className="button-row">
          <button className="sea-button" onClick={() => send('lobby:ready')} disabled={!me || !me.character}>
            {readyLabel}
          </button>
          {isHost && (
            <button className="sea-button" onClick={() => send('lobby:start')} disabled={!allReady}>
              {t('lobby.start')}
            </button>
          )}
        </div>

        <p className="form-message" role="status">{message}</p>
      </div>
    </Screen>
  );
};

type SeatProps = {
  player: LobbyPlayer | null; // null: an empty seat
  isHost: boolean;
  onKick: (() => void) | null; // only the host sees the ✕, and not on their own seat
};

// One seat: the portrait of the fish (the empty bubble before choosing), the name, HOST and READY
const Seat: React.FC<SeatProps> = ({ player, isHost, onKick }) => {
  const { t } = useTranslation();
  if (!player) {
    return (
      <li className="seat empty">
        <img className="seat-portrait" src="/art/bubbles/empty.webp" alt="" />
        <span className="seat-name">{t('lobby.waiting')}</span>
      </li>
    );
  }

  let portrait = '/art/bubbles/empty.webp';
  if (player.character) {
    portrait = `/art/portraits/${player.character}.webp`;
  }

  return (
    <li className="seat">
      <img
        className="seat-portrait"
        src={portrait}
        alt=""
      />
      <span className="seat-name">{player.username}</span>
      <div className="seat-badges">
        {isHost && <span className="gold-badge">{t('lobby.host')}</span>}
        {player.ready && <span className="gold-badge">{t('lobby.ready')}</span>}
      </div>
      {onKick && (
        <button className="seat-kick" onClick={onKick} aria-label={t('lobby.kick', { username: player.username })} title={t('lobby.kick', { username: player.username })}>
          <KickIcon />
        </button>
      )}
    </li>
  );
};

// The ✕, drawn in "pixels" like the « of the screens
const KickIcon: React.FC = () => (
  <svg className="kick-icon" viewBox="0 0 5 5" aria-hidden="true">
    <rect x="0" y="0" width="1" height="1" />
    <rect x="1" y="1" width="1" height="1" />
    <rect x="2" y="2" width="1" height="1" />
    <rect x="3" y="3" width="1" height="1" />
    <rect x="4" y="4" width="1" height="1" />
    <rect x="4" y="0" width="1" height="1" />
    <rect x="3" y="1" width="1" height="1" />
    <rect x="1" y="3" width="1" height="1" />
    <rect x="0" y="4" width="1" height="1" />
  </svg>
);

export default Lobby;
