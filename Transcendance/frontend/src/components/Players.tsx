import { useTranslation } from "react-i18next";
import type { PlayerCount } from "../game/maps";
import Screen from "./Screen";

type PlayersProps = {
	onChoose: (players: PlayerCount) => void;
	onBack: () => void;
	min?: number; // in the SETTINGS of a lobby: never fewer than the players already inside
};

const COUNTS: PlayerCount[] = [2, 3, 4];

// How many players the lobby will have (the first step to create one, and the SETTINGS of the lobby)
export default function Players({ onChoose, onBack, min = 2 }: PlayersProps) {
	const { t } = useTranslation();

	return (
		<Screen title={t("lobby.playersTitle")} onBack={onBack}>
			<div className="flex flex-1 flex-col justify-center gap-screen">
				{COUNTS.map((count) => (
					<button key={count} className="sea-button min-w-[8em]" onClick={() => onChoose(count)} disabled={count < min}>
						{t("lobby.players", { count })}
					</button>
				))}
			</div>
		</Screen>
	);
}
