import { useEffect, useState } from "react";
import { defaultOptions } from "../game/options";
import type { Character, DynamicState, GameStart, MatchOptions } from "../game/protocol";
import { socket } from "../socket";
import GameScreen from "./GameScreen";
import MapSelect from "./MapSelect";
import Options from "./Options";
import Screen from "./Screen";
import Winner from "./Winner";
import "./Lobby.css";
import "./LocalGame.css";

type LocalGameProps = {
	onExit: () => void; // back to the menu
};

const FISH: Character[] = ["goldfish", "betta", "angler", "puffer"];

// The keys of each player (the same as input.ts)
const KEYS = ["W A S D · R", "ARROWS · L"];

// PLAY LOCAL: two players on the same keyboard. The match runs on the server, like an online one:
// the map, the options, the fish of each player, the match and the WINNER screen, all inside this component
export default function LocalGame({ onExit }: LocalGameProps) {
	const [map, setMap] = useState<string | null>(null); // null: still choosing the map
	const [options, setOptions] = useState<MatchOptions | null>(null); // null: still choosing the options
	const [fish, setFish] = useState<(Character | null)[]>([null, null]); // the fish of Player 1 and Player 2
	const [message, setMessage] = useState("");
	const [match, setMatch] = useState<GameStart | null>(null);
	const [result, setResult] = useState<DynamicState | null>(null);

	useEffect(() => {
		// the socket is created without connecting (autoConnect: false): the local mode connects it, like the LOBBIES screen
		socket.connect();

		// the same as LobbySelect: socket.active = it tries again by itself (the server is off...);
		// false = the server refused the connection, and error.message says why
		function handleConnectError(error: Error) {
			setMessage(socket.active ? "Could not connect to the server." : error.message);
		}

		socket.on("game:start", setMatch);
		socket.on("local:error", setMessage);
		socket.on("connect_error", handleConnectError);
		return () => {
			socket.off("game:start", setMatch);
			socket.off("local:error", setMessage);
			socket.off("connect_error", handleConnectError);
		};
	}, []);

	// back to the menu: the connection closes, like the « of the LOBBIES screen
	function handleExit() {
		socket.disconnect();
		onExit();
	}

	// the match is over (final = game:end), the « included: in the local mode it ends the match like the time
	// final = null: the connection came back and the match was gone (game:gone), so back to the choice of the fish
	function handleMatchEnd(final: DynamicState | null) {
		setMatch(null);
		setResult(final);
	}

	function choose(slot: number, character: Character) {
		const next = [...fish]; // a new array: React only draws again when the state is a new value
		next[slot] = character;
		setFish(next);
	}

	function handleStart() {
		setMessage("");
		socket.emit("local:start", { map, characters: fish, options });
	}

	if (match)
		return <GameScreen mode="local" start={match} onEnd={handleMatchEnd} />;
	if (result)
		return <Winner final={result} backLabel="PLAY AGAIN" onBack={() => setResult(null)} onExit={handleExit} />;
	if (map === null)
		return <MapSelect players={2} onChoose={setMap} onBack={handleExit} />;
	if (options === null)
		return <Options initial={defaultOptions()} confirmLabel="NEXT" onChoose={setOptions} onBack={() => setMap(null)} />;

	return (
		<Screen title="FISH" onBack={() => setOptions(null)}>
			<div className="local-setup">
				{[0, 1].map((slot) => (
					<div key={slot} className="local-player">
						<p className="local-player-name">
							PLAYER {slot + 1} <span className="local-keys">{KEYS[slot]}</span>
						</p>
						<div className="fish-choice" role="group" aria-label={`Fish of player ${slot + 1}`}>
							{FISH.map((character) => {
								const other = fish[1 - slot] === character; // the other player already has it
								return (
									<button
										key={character}
										className={fish[slot] === character ? "fish-option mine" : "fish-option"}
										disabled={other}
										onClick={() => choose(slot, character)}
										aria-label={character}
									>
										<img src={`/art/fish/${character}.webp`} alt="" />
										<span className="fish-name">{character}</span>
									</button>
								);
							})}
						</div>
					</div>
				))}

				<div className="button-row">
					<button className="sea-button" onClick={handleStart} disabled={fish[0] === null || fish[1] === null}>
						START
					</button>
				</div>

				<p className="form-message" role="status">{message}</p>
			</div>
		</Screen>
	);
}
