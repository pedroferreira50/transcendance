import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Decoration } from "./Decorations";
import Screen from "./Screen";
import "./Menu.css";

export type MenuChoice = "local" | "online" | "instructions";

type MenuProps = {
	username: string | null; // null: nobody logged in
	notice: string; // why the player was sent back here ("" = nothing)
	onChoose: (choice: MenuChoice) => void;
	onAccount: () => void;
	onBack: () => void;
};

// The images around the title, the goldfish and the buttons (% of the screen)
const DECORATIONS: Decoration[] = [
	{ art: "shark", left: 4.4, top: 7.9, width: 19.5, phone: { left: 5, top: 3, width: 22 } },
	{ art: "bubbles/freeze", left: 11.5, top: 50.5, width: 5.7, phone: { left: 7, top: 22, width: 11 } },
	{ art: "bubbles/speed", left: 19.5, top: 52.3, width: 4.6 },
	{ art: "bubbles/enchant", left: 8.2, top: 63.4, width: 6.6, phone: { left: 9, top: 57, width: 12 } },
	{ art: "bubbles/diamond", left: 77.6, top: 46.8, width: 6.9, phone: { left: 80, top: 21, width: 12 } },
	{ art: "bubbles/diamond", left: 72.7, top: 54.8, width: 4.6 },
	{ art: "bubbles/diamond", left: 81.9, top: 59.4, width: 6.9, phone: { left: 82, top: 57, width: 9 } },
	{ art: "turtle", left: 77.1, top: 72.2, width: 21.4, phone: { left: 60, top: 88, width: 36 } },
];

// A person in "pixels": the head and the body
function AccountIcon() {
	return (
		<svg className="account-icon" viewBox="0 0 10 10" aria-hidden="true">
			<rect x="3" y="0" width="4" height="4" />
			<rect x="1" y="5" width="8" height="5" />
		</svg>
	);
}

// The first screen of Open Sea: the name of the game and the 3 ways to go on
export default function Menu({ username, notice, onChoose, onAccount, onBack }: MenuProps) {
	const { t } = useTranslation();
	// phones and tablets: the same test as GameScreen. There is no keyboard for the local mode
	const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
	// logged in: the profile of the user; if not: the login
	let accountLabel = t("menu.login");
	if (username !== null) {
		accountLabel = t("menu.profileOf", { username });
	}
	const account = (
		<button className="account-button" onClick={onAccount} aria-label={accountLabel} title={accountLabel}>
			<AccountIcon />
		</button>
	);

	return (
		<Screen title={t("menu.title")} onBack={onBack} corner={account} decorations={DECORATIONS}>
			<div className="menu">
				<img className="menu-fish" src="/art/fish/goldfish.webp" alt="" />
				<div className="button-row">
					{!touch && <button className="sea-button" onClick={() => onChoose("local")}>{t("menu.local")}</button>}
					<button className="sea-button" onClick={() => onChoose("online")}>{t("menu.online")}</button>
					<button className="sea-button" onClick={() => onChoose("instructions")}>{t("menu.instructions")}</button>
				</div>
				{notice && <p className="form-message" role="status">{notice}</p>}
			</div>
		</Screen>
	);
}
