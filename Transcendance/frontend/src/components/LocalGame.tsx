import { useEffect, useState } from "react";
import { CHARACTERS, defaultOptions } from "../game/options";
import type { Character, DynamicState, GameStart, MatchOptions } from "../game/protocol";
import { useTranslation } from "react-i18next";
import { socket } from "../socket";
import GameScreen from "./GameScreen";
import MapSelect from "./MapSelect";
import Options from "./Options";
import Screen from "./Screen";
import Winner from "./Winner";
import "./Lobby.css";

type LocalGameProps = {
	onExit: () => void; // back to the menu
};

// PLAY LOCAL: two players on the same keyboard. The match runs on the server, like an online one:
// the map, the options, the fish of each player, the match and the WINNER screen, all inside this component
export default function LocalGame({ onExit }: LocalGameProps) {
	const { t } = useTranslation();
	const [map, setMap] = useState<string | null>(null); // null: still choosing the map
	const [options, setOptions] = useState<MatchOptions>(defaultOptions()); // kept when the « of FISH goes back to OPTIONS
	const [optionsChosen, setOptionsChosen] = useState(false); // false: still on the OPTIONS screen
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
		socket.emit("local:start", { map, characters: fish, options });
	}

	if (match)
		return <GameScreen mode="local" start={match} onEnd={handleMatchEnd} />;
	if (result)
		return <Winner final={result} backLabel={t("winner.playAgain")} local onBack={() => setResult(null)} onExit={handleExit} />;
	if (map === null)
		return <MapSelect players={2} onChoose={setMap} onBack={handleExit} />;
	if (!optionsChosen)
		return <Options initial={options} confirmLabel={t("options.next")} onChoose={(chosen) => { setOptions(chosen); setOptionsChosen(true); }} onBack={() => setMap(null)} />;

	return (
		<Screen title={t("local.fishTitle")} onBack={() => setOptionsChosen(false)}>
			<div className="local-setup flex flex-1 flex-col items-center justify-center gap-[clamp(0.75rem,3vh,2rem)]">
				{[0, 1].map((slot) => (
					<div key={slot} className="local-player flex flex-col items-center gap-[0.4em]">
						<p className="local-player-name m-0 text-center font-[family-name:var(--font-button)] text-[length:clamp(1.3rem,min(2.4vw,4.2vh),2.4rem)] tracking-[0.06em] text-[color:var(--sea-light)]">
							{t("local.player", { n: slot + 1 })}  <span className="local-keys ml-[0.6em] font-[family-name:var(--font-text)] text-[0.6em] tracking-normal opacity-[0.85]"></span>
						</p>
						<div className="fish-choice" role="group" aria-label={t("local.fishOf", { n: slot + 1 })}>
							{CHARACTERS.map((character) => {
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
