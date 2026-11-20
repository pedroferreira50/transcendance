import { useTranslation } from "react-i18next";
import { mapLabel, mapsFor, type PlayerCount } from "../game/maps";
import Screen from "./Screen";

type MapSelectProps = {
	players: PlayerCount;
	onChoose: (map: string) => void; // the name of the map, or "random"
	onBack: () => void;
};

// One card (sea-card of Screen.css), as wide as one of 4 columns, 2 on phones (w-column-*): the picture and the name under it.
// Every picture in a box of the same shape (2:1, about the shape of the maps): the maps have different sizes
function MapCard({ image, label, onClick }: { image: string; label: string; onClick: () => void }) {
	return (
		<button className="sea-card w-column-4 phone:w-column-2 flex flex-col items-center gap-2" onClick={onClick}>
			<img className="aspect-[2/1] w-full object-contain" src={image} alt="" />
			<span className="font-button text-card tracking-[0.06em]">{label}</span>
		</button>
	);
}

// The maps where that number of players fits, and RANDOM (the server picks one when the match starts)

export default function MapSelect({ players, onChoose, onBack }: MapSelectProps) {
	const { t } = useTranslation();

	// 4 cards in a row on computers, 2 on phones; the last row in the middle.
	// On short screens the 2 rows of cards also have to fit in the height (140vh)
	return (
		<Screen title={t("lobby.map")} onBack={onBack}>
			<div className="flex w-full flex-1 flex-col items-center justify-center">
				<div className="flex w-[min(100%,60rem,140vh)] flex-wrap justify-center gap-cards">
					{mapsFor(players).map((name) => (
						<MapCard key={name} image={`/maps/${name}.webp`} label={mapLabel(name)} onClick={() => onChoose(name)} />
					))}
					<MapCard image="/art/bubbles/empty.webp" label={t("lobby.random")} onClick={() => onChoose("random")} />
				</div>
			</div>
		</Screen>
	);
}
