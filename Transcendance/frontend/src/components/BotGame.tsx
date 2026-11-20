import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BOT_LEVELS, CHARACTERS, defaultOptions } from "../game/options";
import type { BotInfo, BotLevel, Character, DynamicState, GameStart, MatchOptions } from "../game/protocol";
import { socket } from "../socket";
import GameScreen from "./GameScreen";
import MapSelect from "./MapSelect";
import Options from "./Options";
import Screen from "./Screen";
import Winner from "./Winner";
import "./Lobby.css";

type BotGameProps = {
	onExit: () => void; // back to the menu
};

// PLAY vs BOT: the player against a fish played by the server.
// MAP -> OPTIONS -> FISH -> LEVEL (it starts the match) -> the match -> WINNER, all inside this component
export default function BotGame({ onExit }: BotGameProps) {
	const { t } = useTranslation();
	const [map, setMap] = useState<string | null>(null); // null: still choosing the map
	const [options, setOptions] = useState<MatchOptions>(defaultOptions()); // kept when going back to OPTIONS
	const [optionsChosen, setOptionsChosen] = useState(false); // false: still on the OPTIONS screen
	const [fish, setFish] = useState<Character | null>(null); // null: still choosing the fish
	const [message, setMessage] = useState("");
	const [match, setMatch] = useState<GameStart | null>(null);
	const [result, setResult] = useState<{ final: DynamicState; bot: BotInfo | null } | null>(null);

	useEffect(() => {
		// the same as PLAY LOCAL: this screen connects the socket and listens to the start of the match
		socket.connect();

		function handleConnectError(error: Error) {
			let nextMessage = error.message;
			if (socket.active) {
				nextMessage = t("lobby.errors.connect");
			}
			setMessage(nextMessage);
		}

		socket.on("game:start", setMatch);
		socket.on("bot:error", setMessage);
		socket.on("connect_error", handleConnectError);
		return () => {
			socket.off("game:start", setMatch);
			socket.off("bot:error", setMessage);
			socket.off("connect_error", handleConnectError);
		};
	}, [t]);

	// back to the menu: the connection closes, like PLAY LOCAL
	function handleExit() {
		socket.disconnect();
		onExit();
	}

	// the match is over (final = game:end); final = null: the player left it (a forfeit) or it was gone
	function handleMatchEnd(final: DynamicState | null) {
		setResult(final ? { final, bot: match?.bot ?? null } : null);
		setMatch(null);
	}

	// one level: the match starts with everything chosen before
	function start(level: BotLevel) {
		setMessage("");
		socket.emit("bot:start", { map, character: fish, options, level });
	}

	if (match)
		return <GameScreen mode="online" start={match} onEnd={handleMatchEnd} />;
	// PLAY AGAIN goes back to LEVEL, with the same map, options and fish
	if (result)
		return <Winner final={result.final} bot={result.bot} backLabel={t("winner.playAgain")} onBack={() => setResult(null)} onExit={handleExit} />;
	if (map === null)
		return <MapSelect players={2} onChoose={setMap} onBack={handleExit} />;
	if (!optionsChosen)
		return <Options initial={options} confirmLabel={t("options.next")} onChoose={(chosen) => { setOptions(chosen); setOptionsChosen(true); }} onBack={() => setMap(null)} />;

	// FISH: choosing one goes to LEVEL
	if (fish === null)
		return (
			<Screen title={t("bot.fishTitle")} onBack={() => setOptionsChosen(false)}>
				<div className="flex flex-1 flex-col items-center justify-center gap-screen">
					<div className="fish-choice" role="group" aria-label={t("bot.chooseFish")}>
						{CHARACTERS.map((character) => (
							<button key={character} className="fish-option" onClick={() => setFish(character)} aria-label={character}>
								<img src={`/art/fish/${character}.webp`} alt="" />
								<span className="fish-name">{character}</span>
							</button>
						))}
					</div>
				</div>
			</Screen>
		);

	// LEVEL: each button starts the match at that level
	return (
		<Screen title={t("bot.levelTitle")} onBack={() => setFish(null)}>
			<div className="flex flex-1 flex-col items-center justify-center gap-screen">
				<div className="flex items-start justify-center gap-[clamp(1rem,3vw,3rem)] standing:flex-col standing:items-center" role="group" aria-label={t("bot.chooseLevel")}>
					{BOT_LEVELS.map((level) => (
						<div key={level} className="flex flex-col items-center gap-[0.4em]">
							<button className="sea-button min-w-[6em]" onClick={() => start(level)}>
								{t(`bot.levels.${level}`)}
							</button>
							<p className="m-0 max-w-[12em] text-center text-hint text-sea-light standing:max-w-[18em]">{t(`bot.about.${level}`)}</p>
						</div>
					))}
				</div>

				<p className="form-message" role="status">{message}</p>
			</div>
		</Screen>
	);
}
