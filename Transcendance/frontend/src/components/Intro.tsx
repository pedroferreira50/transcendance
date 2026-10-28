import Screen from "./Screen";
import "./Intro.css";

type IntroProps = {
	onPlay: () => void;
};

// The story of the game, before the menu.
// The goldfish, the puffer and the bubbles come in when their art is ready
export default function Intro({ onPlay }: IntroProps) {
	return (
		<Screen title="OPEN SEA">
			<div className="intro">
				<p className="text-box story">
					The cold season has arrived, and the reef is running out of food.
					Only one creature knows the way to the Open Sea, where the water is calm
					and there is plenty to eat: an old sea turtle who waits at the far end of the reef.
					She can carry only <strong>one fish</strong> on her back, and her price is diamonds.
				</p>
				<button className="sea-button intro-play" onClick={onPlay}>PLAY</button>
			</div>
		</Screen>
	);
}
