import { useEffect, useRef, type CSSProperties } from "react";
import { toCommand, type Command } from "../game/input";
import type { Direction } from "../game/protocol";

// While a button is held, the move is sent again at this interval. Faster than any move cooldown
// (150 ms, 75 ms with speed): the server ignores the extra ones, like when a key is held
const REPEAT_MS = 50;

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

// The buttons of the phones and tablets: arrows at the bottom left, power-up at the bottom right
export default function TouchControls({ send }: { send: (command: Command) => void }) {
	const timer = useRef<number | undefined>(undefined);

	const stop = () => {
		clearInterval(timer.current);
		timer.current = undefined;
	};

	// once now, and again every REPEAT_MS while the finger stays on the button
	const start = (dir: Direction) => {
		stop();
		send(toCommand(dir));
		timer.current = window.setInterval(() => send(toCommand(dir)), REPEAT_MS);
	};

	// the screen closed with a finger still on a button
	useEffect(() => {
		const held = timer;
		return () => clearInterval(held.current);
	}, []);

	return (
		<>
			<div style={{ position: "fixed", left: 16, bottom: 16, display: "grid", gridTemplateColumns: "repeat(3, 64px)", gap: 4 }}>
				{PAD.map(([dir, arrow, column, row]) => (
					<button
						key={dir}
						style={{ ...BUTTON, gridColumn: column, gridRow: row }}
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
				aria-label="power-up"
				style={{ ...BUTTON, position: "fixed", right: 16, bottom: 16, width: 88, height: 88, background: "url(/sprites/bubble.webp) center / cover, rgba(0, 0, 0, 0.35)" }}
				onPointerDown={() => send(toCommand("powerUp"))}
				onContextMenu={(event) => event.preventDefault()}
			/>
		</>
	);
}
