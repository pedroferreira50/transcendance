import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Screen from "./Screen";
import "./Instructions.css";

type InstructionsProps = {
	onBack: () => void;
};

// One line of the rules: the icon, the text (and a note under it), and maybe a second icon after the box.
// The icons are the files of public/art/icons
type Rule = {
	icon: string;
	text: string;
	note?: string;
	after?: string;
};



// the keys of src/game/input.ts: [up, left, down, right]
const WASD = ["W", "A", "S", "D"];
const ARROWS = ["↑", "←", "↓", "→"];

function Icon({ name }: { name: string }) {
	return <img className="rule-icon" src={`/art/icons/${name}.webp`} alt="" />;
}

function RuleList({ rules }: { rules: Rule[] }) {
	return (
		<ul className="rule-list">
			{rules.map((rule) => (
				<li key={rule.icon} className="rule">
					<Icon name={rule.icon} />
					<p className="text-box">
						{rule.text}
						{rule.note && <span className="rule-note">{rule.note}</span>}
					</p>
					{rule.after && <Icon name={rule.after} />}
				</li>
			))}
		</ul>
	);
}

type KeysProps = {
	move: string[];
	power: string;
	powerFirst?: boolean; // the keys of the right hand: L comes before the arrows, like on the keyboard
};

// One set of keys: the 4 of the movement + the one of the power-up
function Keys({ move, power, powerFirst }: KeysProps) {
	const { t } = useTranslation();
	const [up, left, down, right] = move;
	const movement = (
		<div className="key-group">
			<div className="key-cluster">
				<kbd className="keycap">{up}</kbd>
				<div>
					<kbd className="keycap">{left}</kbd>
					<kbd className="keycap">{down}</kbd>
					<kbd className="keycap">{right}</kbd>
				</div>
			</div>
			<span>{t("instructions.movement")}</span>
		</div>
	);
	const powerUp = (
		<div className="key-group">
			<kbd className="keycap">{power}</kbd>
			<span>{t("instructions.power")}</span>
		</div>
	);
	let first = movement;
	let second = powerUp;
	if (powerFirst) {
		first = powerUp;
		second = movement;
	}
	return (
		<div className="key-row">
			{first}
			<span className="key-plus">+</span>
			{second}
		</div>
	);
}

// [arrow, column, row] in a 3x3 grid: the same cross as TouchControls
const PAD: [string, number, number][] = [
	["▲", 2, 1],
	["◀", 1, 2],
	["▶", 3, 2],
	["▼", 2, 3],
];

// The buttons that phones and tablets show over the match (TouchControls): the cross and the bubble
function TouchKeys() {
	const { t } = useTranslation();
	return (
		<div className="key-row">
			<div className="key-group">
				<div className="touch-pad">
					{PAD.map(([arrow, column, row]) => (
						<span key={arrow} className="touch-button" style={{ gridColumn: column, gridRow: row }}>{arrow}</span>
					))}
				</div>
				<span>{t("instructions.movement")}</span>
			</div>
			<span className="key-plus">+</span>
			<div className="key-group">
				<span className="touch-button touch-power" />
				<span>{t("instructions.power")}</span>
			</div>
		</div>
	);
}

// The name of the player and, under it, their keys (one set, or the two sets with "or" between them)
function PlayerKeys({ name, children }: { name: string; children: ReactNode }) {
	return (
		<div className="player-keys">
			<p>{name}</p>
			{children}
		</div>
	);
}

// How to play: the goal and the power-ups on top, the keys of each mode under them
export default function Instructions({ onBack }: InstructionsProps) {
	const { t } = useTranslation();
	// phones and tablets: the same test as GameScreen. There the local mode (one keyboard) does not exist
	const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);

		const goals: Rule[] = [
		{ icon: "diamond", text: t("instructions.goals.diamonds") },
		{ icon: "turtle", text: t("instructions.goals.turtle") },
		{ icon: "shark", text: t("instructions.goals.sharks") },
	];

	// the seconds are the same as SPEED/FREEZE/ENCHANT_DURATION_MS of backend/src/game/config.ts
	const powerUps: Rule[] = [
		{ icon: "speed", text: t("instructions.powerUps.speed") },
		{ icon: "freeze", text: t("instructions.powerUps.freeze"), note: t("instructions.powerUps.freezeNote"), after: "shark-frozen" },
		{ icon: "enchant", text: t("instructions.powerUps.enchant"), note: t("instructions.powerUps.enchantNote"), after: "shark-enchanted" },
	];

	let onlineKeys = (
		<div className="key-options">
			<Keys move={WASD} power="R" />
			<span className="key-or">{t("instructions.or")}</span>
			<Keys move={ARROWS} power="L" powerFirst />
		</div>
	);
	if (touch) {
		onlineKeys = <TouchKeys />;
	}
	return (
		<Screen title={t("instructions.title")} onBack={onBack}>
			<div className="instructions">
				<div className="rules">
					<RuleList rules={goals} />
					<RuleList rules={powerUps} />
				</div>
				<div className="modes">
					{!touch && (
						<section className="mode">
							<span className="gold-badge">{t("instructions.local")}</span>
							<div className="mode-players">
								<PlayerKeys name={t("instructions.player", { n: 1 })}>
									<Keys move={WASD} power="R" />
								</PlayerKeys>
								<PlayerKeys name={t("instructions.player", { n: 2 })}>
									<Keys move={ARROWS} power="L" powerFirst />
								</PlayerKeys>
							</div>
						</section>
					)}
					<section className="mode">
						<span className="gold-badge">{t("instructions.online")}</span>
						<div className="mode-players">
							<PlayerKeys name={t("instructions.players14")}>
								{onlineKeys}
							</PlayerKeys>
						</div>
					</section>
				</div>
			</div>
		</Screen>
	);
}
