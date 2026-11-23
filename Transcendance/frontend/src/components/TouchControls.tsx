import { useEffect, useRef, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { toCommand, type Command } from "../game/input";
import type { Direction } from "../game/protocol";

// A tap moves once. Held longer than this, the move starts repeating, like a key held on the keyboard
// (a quick tap lasts more than the move cooldown, so without this wait one tap moved 2 or 3 times)
const HOLD_DELAY_MS = 250;

// While a button is held, the move is sent again at this interval. As fast as the shortest move cooldown
// (100 ms, 50 ms with speed): the server ignores the extra ones, like when a key is held
const REPEAT_MS = 50;

// The size of each arrow: follows the height of the screen, so on a phone lying down the cross
// does not cover half of the map (64 px on a phone standing up and on tablets, where there is room)
const ARROW_SIZE = "clamp(40px, 11vh, 64px)";

const BUTTON: CSSProperties = {
	width: 64,
	height: 64,
	fontSize: 26,
	color: "#fff",
	background: "rgba(0, 0, 0, 0.35)",
	border: "2px solid rgba(255, 255, 255, 0.5)",
	borderRadius: "50%",
	touchAction: "none", // the finger on the button does not scroll or zoom the page
	userSelect: "none",
};

// [direction, arrow, column, row] in a 3x3 grid, like a cross
const PAD: [Direction, string, number, number][] = [
	["up", "▲", 2, 1],
	["left", "◀", 1, 2],
	["right", "▶", 3, 2],
	["down", "▼", 2, 3],
];

const ARROW: CSSProperties = {
	...BUTTON,
	width: ARROW_SIZE,
	height: ARROW_SIZE,
	padding: 0, // the arrow in the middle of the circle, even when the circle is small
	fontSize: `calc(${ARROW_SIZE} * 0.4)`,
	lineHeight: 1,
	background: "rgba(0, 0, 0, 0.25)", // a little more of the map shows through
};

// The buttons of the phones and tablets: arrows at the bottom left, power-up at the bottom right
export default function TouchControls({ send }: { send: (command: Command) => void }) {
	const { t } = useTranslation();
	const timer = useRef<number | undefined>(undefined);

	const stop = () => {
		clearTimeout(timer.current); // still waiting to start repeating
		clearInterval(timer.current); // or already repeating
		timer.current = undefined;
	};

	// once now and, if the finger stays on the button, again every REPEAT_MS after HOLD_DELAY_MS
	const start = (dir: Direction) => {
		stop();
		send(toCommand(dir));
		timer.current = window.setTimeout(() => {
			timer.current = window.setInterval(() => send(toCommand(dir)), REPEAT_MS);
		}, HOLD_DELAY_MS);
	};

	// the screen closed with a finger still on a button
	useEffect(() => {
		const held = timer;
		return () => clearInterval(held.current);
	}, []);

	return (
		<>
			<div style={{ position: "fixed", left: 8, bottom: 8, display: "grid", gridTemplateColumns: `repeat(3, ${ARROW_SIZE})` }}>
				{PAD.map(([dir, arrow, column, row]) => (
					<button
						key={dir}
						style={{ ...ARROW, gridColumn: column, gridRow: row }}
						onPointerDown={() => start(dir)}
						onPointerUp={stop}
						onPointerCancel={stop}
						onPointerLeave={stop}
						onContextMenu={(event) => event.preventDefault()}
					>
						{arrow}
					</button>
				))}
			</div>
			<button
				aria-label={t("game.powerUp")}
				style={{ ...BUTTON, position: "fixed", right: 16, bottom: 16, width: 88, height: 88, background: "url(/sprites/bubble.webp) center / cover, rgba(0, 0, 0, 0.35)" }}
				onPointerDown={() => send(toCommand("powerUp"))}
				onContextMenu={(event) => event.preventDefault()}
			/>
		</>
	);
}
