import { useState, type ReactNode } from "react";
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

const GOALS: Rule[] = [
	{ icon: "diamond", text: "Collect enough diamonds" },
	{ icon: "turtle", text: "Reach the turtle before your rival does" },
	{ icon: "shark", text: "Watch out for sharks!" },
];

// the seconds are the same as SPEED/FREEZE/ENCHANT_DURATION_MS of backend/src/game/config.ts
const POWER_UPS: Rule[] = [
	{ icon: "speed", text: "Swim faster for 5 seconds" },
	{ icon: "freeze", text: "Freeze everyone for 2 seconds", note: "(but don't touch the sharks!)", after: "shark-frozen" },
	{ icon: "enchant", text: "Enchant sharks for 5 seconds", note: "(The sharks won't hurt you!)", after: "shark-enchanted" },
];

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
			<span>(Movement)</span>
		</div>
	);
	const powerUp = (
		<div className="key-group">
			<kbd className="keycap">{power}</kbd>
			<span>(Power)</span>
		</div>
	);
	return (
		<div className="key-row">
			{powerFirst ? powerUp : movement}
			<span className="key-plus">+</span>
			{powerFirst ? movement : powerUp}
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
	return (
		<div className="key-row">
			<div className="key-group">
				<div className="touch-pad">
					{PAD.map(([arrow, column, row]) => (
						<span key={arrow} className="touch-button" style={{ gridColumn: column, gridRow: row }}>{arrow}</span>
					))}
				</div>
				<span>(Movement)</span>
			</div>
			<span className="key-plus">+</span>
			<div className="key-group">
				<span className="touch-button touch-power" />
				<span>(Power)</span>
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
	// phones and tablets: the same test as GameScreen. There the local mode (one keyboard) does not exist
	const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);

	return (
		<Screen title="INSTRUCTIONS" onBack={onBack}>
			<div className="instructions">
				<div className="rules">
					<RuleList rules={GOALS} />
					<RuleList rules={POWER_UPS} />
				</div>
				<div className="modes">
					{!touch && (
						<section className="mode">
							<span className="gold-badge">LOCAL</span>
							<div className="mode-players">
								<PlayerKeys name="Player 1">
									<Keys move={WASD} power="R" />
								</PlayerKeys>
								<PlayerKeys name="Player 2">
									<Keys move={ARROWS} power="L" powerFirst />
								</PlayerKeys>
							</div>
						</section>
					)}
					<section className="mode">
						<span className="gold-badge">ONLINE</span>
						<div className="mode-players">
							<PlayerKeys name="Player 1-4">
								{touch ? <TouchKeys /> : (
									<div className="key-options">
										<Keys move={WASD} power="R" />
										<span className="key-or">or</span>
										<Keys move={ARROWS} power="L" powerFirst />
									</div>
								)}
							</PlayerKeys>
						</div>
					</section>
				</div>
			</div>
		</Screen>
	);
}
