import type { Decoration } from "./Decorations";
import { useTranslation } from "react-i18next";
import Screen from "./Screen";

type IntroProps = {
	onPlay: () => void;
};

// The images around the story (% of the screen): the turtle of the story and the goldfish
const DECORATIONS: Decoration[] = [
	{ art: "bubbles/diamond", left: 12.8, top: 20.4, width: 8, phone: { left: 7, top: 17, width: 13 } },
	{ art: "bubbles/diamond", left: 6.8, top: 33.3, width: 6.9, phone: { left: 22, top: 22, width: 9 } },
	{ art: "turtle", left: 72.9, top: 15, width: 21.6, flip: true, phone: { left: 56, top: 15, width: 36 } },
	{ art: "fish/goldfish", left: 4.6, top: 65.3, width: 27.1, phone: { left: 5, top: 61, width: 40 } },
	{ art: "bubbles/diamond", left: 80, top: 59.7, width: 4.4 },
	{ art: "bubbles/diamond", left: 74.8, top: 74, width: 6.9, phone: { left: 70, top: 86, width: 12 } },
	{ art: "bubbles/diamond", left: 84.7, top: 69.6, width: 6.9, phone: { left: 82, top: 80, width: 10 } },
];

// The story of the game, before the menu
export default function Intro({ onPlay }: IntroProps) {
	const { t } = useTranslation();

	return (
		<Screen title={t("menu.title")} decorations={DECORATIONS}>
			<div className="flex flex-1 flex-col items-center justify-evenly gap-[clamp(0.75rem,5vh,4rem)]">
				<p className="balloon max-w-[min(30em,40vw)] text-center text-story leading-[1.7] phone:max-w-[30em] short:max-w-[30em] short:leading-[1.5]">
					{t("intro.story")}
				</p>
				<button className="sea-button min-w-[min(70vw,8em)]" onClick={onPlay}>{t("intro.play")}</button>
			</div>
		</Screen>
	);
}
