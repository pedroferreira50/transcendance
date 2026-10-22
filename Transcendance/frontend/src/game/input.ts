import type { Direction } from "./protocol";

// online: each one plays on their own device, every key moves "my" fish
// local: two players on the same keyboard, each set of keys moves one fish
export type InputMode = "online" | "local";

// What a key asks for. slot = whose fish: only in the local mode (online, the server knows who sent it)
export type Command =
	| { type: "move"; dir: Direction; slot?: number }
	| { type: "powerUp"; slot?: number };

type Action = Direction | "powerUp";

// event.code (the physical key, the same on any keyboard layout) -> [slot in the local mode, what to do]
const KEYS: Record<string, [number, Action]> = {
	KeyW: [0, "up"],
	KeyA: [0, "left"],
	KeyS: [0, "down"],
	KeyD: [0, "right"],
	KeyR: [0, "powerUp"],
	ArrowUp: [1, "up"],
	ArrowLeft: [1, "left"],
	ArrowDown: [1, "down"],
	ArrowRight: [1, "right"],
	KeyL: [1, "powerUp"],
};

// The command of one action; the slot goes only in the local mode
export function toCommand(action: Action, slot?: number): Command {
	if (action === "powerUp")
		return slot === undefined ? { type: "powerUp" } : { type: "powerUp", slot };
	return slot === undefined ? { type: "move", dir: action } : { type: "move", dir: action, slot };
}

// Listens to the keyboard and calls send() for each command.
// Returns the function that stops listening (to use as the cleanup of a useEffect)
export function createInput(mode: InputMode, send: (command: Command) => void): () => void {
	const onKey = (event: KeyboardEvent) => {
		const key = KEYS[event.code];
		if (!key)
			return;
		// Ctrl+R, Ctrl+W... are for the browser, not for the game
		if (event.ctrlKey || event.metaKey || event.altKey)
			return;
		// typing in a text field (the chat, later) does not move the fish
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
			return;
		event.preventDefault(); // the arrows would scroll the page
		const [slot, action] = key;
		send(toCommand(action, mode === "local" ? slot : undefined));
	};
	window.addEventListener("keydown", onKey);
	return () => window.removeEventListener("keydown", onKey);
}
