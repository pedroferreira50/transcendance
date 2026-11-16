import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Decorations, { type Decoration } from "./Decorations";
import LanguageSwitcher from "./LanguageSwitcher";
import "./Screen.css";

type ScreenProps = {
	title?: string;
	onBack?: () => void; // without it, the « does not appear
	corner?: ReactNode; // what goes beside the « (the account button of the menu)
	decorations?: Decoration[]; // the images around the content (the shark, the turtle, the bubbles...)
	children?: ReactNode;
};

// The «, drawn in "pixels": each [x, y] is one block of 2x2 of one arrow
const ARROW = [[2, 0], [1, 1], [0, 2], [1, 3], [2, 4]];

export function BackIcon() {
	return (
		<svg className="back-icon" viewBox="0 0 12 10" aria-hidden="true">
			{[0, 3].map((shift) => ARROW.map(([x, y]) => (
				<rect key={`${shift}-${y}`} x={(x + shift) * 2} y={y * 2} width="2" height="2" />
			)))}
		</svg>
	);
}

// The base of every Open Sea screen (out of the match): the gradient, the frame of rocks,
// the « that goes one step back, the title, and under it the content of the screen
export default function Screen({ title, onBack, corner, decorations, children }: ScreenProps) {
	const { t } = useTranslation();

	return (
		<div className="screen">
			<div className="screen-frame" />
			{decorations && <Decorations items={decorations} />}
			{onBack && (
				<button className="back-button" onClick={onBack} aria-label={t("common.back")}>
					<BackIcon />
				</button>
			)}
			{corner}
			{title && <h1 className="screen-title">{title}</h1>}
			<div className="screen-content">{children}</div>
			<footer className="screen-footer">
				<a href="/privacy">{t("common.privacy")}</a>
				<a href="/terms">{t("common.terms")}</a>
				<LanguageSwitcher />
			</footer>
		</div>
	);
}
