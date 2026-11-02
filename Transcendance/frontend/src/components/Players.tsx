import type { PlayerCount } from "../game/maps";
import Screen from "./Screen";
import "./Players.css";

type PlayersProps = {
	onChoose: (players: PlayerCount) => void;
	onBack: () => void;
	min?: number; // in the SETTINGS of a lobby: never fewer than the players already inside
};

const COUNTS: PlayerCount[] = [2, 3, 4];

// How many players the lobby will have (the first step to create one, and the SETTINGS of the lobby)
export default function Players({ onChoose, onBack, min = 2 }: PlayersProps) {
	return (
		<Screen title="PLAYERS" onBack={onBack}>
			<div className="players">
				{COUNTS.map((count) => (
					<button key={count} className="sea-button" onClick={() => onChoose(count)} disabled={count < min}>
						{count} PLAYERS
					</button>
				))}
			</div>
		</Screen>
	);
}
