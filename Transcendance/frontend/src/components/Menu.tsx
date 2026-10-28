import Screen from "./Screen";
import "./Menu.css";

export type MenuChoice = "local" | "online" | "instructions";

type MenuProps = {
	onChoose: (choice: MenuChoice) => void;
	onBack: () => void;
};

// The first screen of Open Sea: the name of the game and the 3 ways to go on.
// The shark, the goldfish, the turtle and the bubbles come in when the art is ready
export default function Menu({ onChoose, onBack }: MenuProps) {
	return (
		<Screen title="OPEN SEA" onBack={onBack}>
			<div className="menu">
				<div className="button-row">
					<button className="sea-button" onClick={() => onChoose("local")}>PLAY LOCAL</button>
					<button className="sea-button" onClick={() => onChoose("online")}>PLAY ONLINE</button>
					<button className="sea-button" onClick={() => onChoose("instructions")}>INSTRUCTIONS</button>
				</div>
			</div>
		</Screen>
	);
}
