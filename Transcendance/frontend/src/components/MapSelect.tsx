import { mapLabel, mapsFor, type PlayerCount } from "../game/maps";
import Screen from "./Screen";
import "./MapSelect.css";

type MapSelectProps = {
	players: PlayerCount;
	onChoose: (map: string) => void; // the name of the map, or "random"
	onBack: () => void;
};

// One card: the picture and the name under it
function MapCard({ image, label, onClick }: { image: string; label: string; onClick: () => void }) {
	return (
		<button className="map-card" onClick={onClick}>
			<img className="map-image" src={image} alt="" />
			<span className="map-name">{label}</span>
		</button>
	);
}

// The maps where that number of players fits, and RANDOM (the server picks one when the match starts)
export default function MapSelect({ players, onChoose, onBack }: MapSelectProps) {
	return (
		<Screen title="MAP" onBack={onBack}>
			<div className="map-select">
				<div className="map-grid">
					{mapsFor(players).map((name) => (
						<MapCard key={name} image={`/maps/${name}.webp`} label={mapLabel(name)} onClick={() => onChoose(name)} />
					))}
					<MapCard image="/art/bubbles/empty.webp" label="RANDOM" onClick={() => onChoose("random")} />
				</div>
			</div>
		</Screen>
	);
}
