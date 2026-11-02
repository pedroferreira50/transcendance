import type { DynamicState, EndReason, PlayerView } from "../game/protocol";
import type { Decoration } from "./Decorations";
import Screen from "./Screen";
import "./Winner.css";

type WinnerProps = {
	final: DynamicState; // the last state of the match (game:end)
	onBack: () => void; // back to the lobby (a rematch)
	onExit: () => void; // leaves the lobby
};

// The power-ups on the left and the diamonds on the right (% of the screen)
const DECORATIONS: Decoration[] = [
	{ art: "bubbles/speed", left: 20.6, top: 21.9, width: 5.6 },
	{ art: "bubbles/freeze", left: 8.4, top: 29.4, width: 6.9, phone: { left: 6, top: 15, width: 11 } },
	{ art: "bubbles/enchant", left: 13, top: 49.7, width: 8.3 },
	{ art: "bubbles/diamond", left: 79.4, top: 26.3, width: 7.5, phone: { left: 82, top: 15, width: 11 } },
	{ art: "bubbles/diamond", left: 71.9, top: 36.1, width: 4.9 },
	{ art: "bubbles/diamond", left: 85.3, top: 45.6, width: 7.6 },
];

// How the winner won, under their name
const REASONS: Record<EndReason, string> = {
	exit: "Reached the turtle first.",
	timeout: "Had the most diamonds when the time ran out.",
	forfeit: "Was the last one left in the match.",
};

// One player of the match: the portrait, the name, the diamonds and the deaths
function Result({ player, winner }: { player: PlayerView; winner: boolean }) {
	// left the match (or did not come back): their numbers stay, but faded
	const gone = player.status === "left" || player.status === "disconnected";
	let className = "result";
	if (winner)
		className += " winner";
	if (gone)
		className += " gone";

	return (
		<li className={className}>
			<img className="result-portrait" src={`/art/portraits/${player.character}.webp`} alt="" />
			<span className="result-name">{player.username}</span>
			<span className="result-numbers">
				<img className="result-icon" src="/sprites/icon-diamond.webp" alt="diamonds" /> {player.diamonds}
				<span className="result-deaths" aria-label="deaths">☠ {player.deaths}</span>
			</span>
		</li>
	);
}

// The end of the match: who won (the fish on the turtle) and how everyone did.
// A draw (the time ran out with a tie at the top) has no winner: only the turtle
export default function Winner({ final, onBack, onExit }: WinnerProps) {
	const winner = final.winnerSlot === null ? null : final.players[final.winnerSlot];

	return (
		<Screen title={winner ? "WINNER" : "DRAW"} onBack={onBack} decorations={DECORATIONS}>
			<div className="winner-screen">
				<img
					className="winner-art"
					src={winner ? `/art/winner/${winner.character}.webp` : "/art/turtle.webp"}
					alt=""
				/>
				{winner && (<p className="winner-line">{winner.username} IS THE WINNER!</p>)}
				{!winner && <p className="winner-line">NOBODY WON!</p>}
				<p className="winner-reason">
					{winner && final.endReason ? REASONS[final.endReason] : "The time ran out with a tie in diamonds."}
				</p>

				<ul className="results">
					{final.players.map((player) => (
						<Result key={player.slot} player={player} winner={player.slot === final.winnerSlot} />
					))}
				</ul>

				<div className="button-row">
					<button className="sea-button" onClick={onBack}>BACK TO LOBBY</button>
					<button className="sea-button secondary" onClick={onExit}>EXIT</button>
				</div>
			</div>
		</Screen>
	);
}
