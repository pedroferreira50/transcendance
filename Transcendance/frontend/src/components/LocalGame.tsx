import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Character, DynamicState, GameStart } from "../game/protocol";
import { socket } from "../socket";
import GameScreen from "./GameScreen";
import MapSelect from "./MapSelect";
import Screen from "./Screen";
import Winner from "./Winner";
import "./Lobby.css";
import "./LocalGame.css";

type LocalGameProps = {
	onExit: () => void; // back to the menu
};

const FISH: Character[] = ["goldfish", "betta", "angler", "puffer"];

// PLAY LOCAL: two players on the same keyboard. The match runs on the server, like an online one:
// the map, the fish of each player, the match and the WINNER screen, all inside this component
export default function LocalGame({ onExit }: LocalGameProps) {
	const { t } = useTranslation();
	// The keys of each player (the same as input.ts)
	const keys = [t("local.keys"), t("local.keys2")];
	const [map, setMap] = useState<string | null>(null); // null: still choosing the map
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
			let nextMessage = error.message;
			if (socket.active) {
				nextMessage = t("lobby.errors.connect");
			}
			setMessage(nextMessage);
		}

		socket.on("game:start", setMatch);
		socket.on("local:error", setMessage);
		socket.on("connect_error", handleConnectError);
		return () => {
			socket.off("game:start", setMatch);
			socket.off("local:error", setMessage);
			socket.off("connect_error", handleConnectError);
		};
	}, [t]);

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
		socket.emit("local:start", { map, characters: fish });
	}

	if (match)
		return <GameScreen mode="local" start={match} onEnd={handleMatchEnd} />;
	if (result)
		return <Winner final={result} backLabel={t("winner.playAgain")} onBack={() => setResult(null)} onExit={handleExit} />;
	if (map === null)
		return <MapSelect players={2} onChoose={setMap} onBack={handleExit} />;

	return (
		<Screen title={t("local.fishTitle")} onBack={() => setMap(null)}>
			<div className="local-setup">
				{[0, 1].map((slot) => (
					<div key={slot} className="local-player">
						<p className="local-player-name">
							{t("local.player", { n: slot + 1 })} <span className="local-keys">{keys[slot]}</span>
						</p>
						<div className="fish-choice" role="group" aria-label={t("local.fishOf", { n: slot + 1 })}>
							{FISH.map((character) => {
								const other = fish[1 - slot] === character; // the other player already has it
								let className = "fish-option";
								if (fish[slot] === character) {
									className = "fish-option mine";
								}
								return (
									<button
										key={character}
										className={className}
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
						{t("local.start")}
					</button>
				</div>

				<p className="form-message" role="status">{message}</p>
			</div>
		</Screen>
	);
}
