import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createInput, type Command, type InputMode } from "../game/input";
import type { DynamicState, GameStart } from "../game/protocol";
import { drawFrame, trackSharks, type SharkMemory } from "../game/renderer";
import { loadMapImage, loadSprites, type Sprites } from "../game/sprites";
import { socket } from "../socket";
import { BackIcon } from "./Screen";
import TouchControls from "./TouchControls";
import "./GameScreen.css";

// The size the sprites and the map images were made at: never stretch them beyond it
const MAX_TILE = 64;

type Assets = {
	sprites: Sprites;
	mapImage: HTMLImageElement | null;
};

type GameScreenProps = {
	mode: InputMode | "watch";
	start: GameStart; // what the server sent in game:start: the map, my slot and the first state
	onEnd: (final: DynamicState | null) => void; // the last state (game:end), or null when I left
};

// What a key (or a touch button) asks for goes to the server; online it knows whose fish it is by the socket,
// local the command carries the slot (undefined online: it does not even go in the message)
function sendCommand(command: Command): void {
	// no connection: Socket.IO would keep the commands and send all of them at once when it comes back
	if (!socket.connected)
		return;
	if (command.type === "move")
		socket.emit("game:move", { dir: command.dir, slot: command.slot });
	else
		socket.emit("game:usePowerUp", { slot: command.slot });
}

// The match screen: draws the last state the server sent, and sends the keys to it
export default function GameScreen({ mode, start, onEnd }: GameScreenProps) {
	const { t } = useTranslation();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const showWalls = useRef(false);
	const sharks = useRef<SharkMemory>({ last: [], facing: [] });
	// the last game:state: a ref and not a state, because the drawing reads it at every frame
	// and a new state (many per second) does not need React to draw the page again
	const state = useRef<DynamicState>(start.state);
	const [countdown, setCountdown] = useState(() => {
		if (start.state.status === "countdown")
			return start.countdown;
		return 0;
	});
	const [assets, setAssets] = useState<Assets | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [connected, setConnected] = useState(socket.connected); // false: the RECONNECTING message
	const [leaveConfirm, setLeaveConfirm] = useState(false);
	// phones and tablets (the main way to point is a finger); it does not change while the screen is open
	const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);

	// Once, when the screen opens: load the sprites and the image of the map
	useEffect(() => {
		Promise.all([loadSprites(), loadMapImage(start.map.name)])
			.then(([sprites, mapImage]) => setAssets({ sprites, mapImage }))
			.catch((err: Error) => setError(err.message));
	}, [start.map.name]);

	// What the server sends during the match
	useEffect(() => {
		function handleState(next: DynamicState) {
			state.current = next;
			if (next.status !== "countdown")
				setCountdown(0);
		}

		function handleConnect() {
			setConnected(true);
		}

		function handleDisconnect() {
			setConnected(false);
      setLeaveConfirm(false);
		}

		// back online, but this match is not there anymore: nothing else would ever arrive for this screen
		function handleGone() {
			onEnd(null);
		}

		socket.on("game:countdown", setCountdown);
		socket.on("game:state", handleState);
		socket.on("game:end", onEnd);
		socket.on("game:gone", handleGone);
		socket.on("connect", handleConnect);
		socket.on("disconnect", handleDisconnect);
		return () => {
			socket.off("game:countdown", setCountdown);
			socket.off("game:state", handleState);
			socket.off("game:end", onEnd);
			socket.off("game:gone", handleGone);
			socket.off("connect", handleConnect);
			socket.off("disconnect", handleDisconnect);
		};
	}, [onEnd]);

	// F2 turns on/off the walls of the .ber over the art
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.code === "F2")
				showWalls.current = !showWalls.current;
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// The keys of the game (createInput already returns the function that removes them)
	useEffect(() => {
		if (mode === "watch" || leaveConfirm)
			return;
		return createInput(mode, sendCommand);
	}, [leaveConfirm, mode]);

	// When everything is loaded: draw at every frame of the screen, until the component closes
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!assets || !canvas)
			return;
		const ctx = canvas.getContext("2d");
		if (!ctx)
			return;
		let frame = 0;
		const draw = (now: number) => {
			const map = start.map;
			const fit = Math.floor(Math.min(window.innerWidth / map.width, window.innerHeight / map.height));
			const tile = Math.max(1, Math.min(MAX_TILE, fit));
			const width = map.width * tile;
			const height = map.height * tile;
			// screens with zoom (laptops at 125%, 150%...) have more real pixels than CSS pixels
			const dpr = window.devicePixelRatio || 1;
			if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
				canvas.width = Math.round(width * dpr);
				canvas.height = Math.round(height * dpr);
				canvas.style.width = `${width}px`;
				canvas.style.height = `${height}px`;
			}
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.imageSmoothingQuality = "high";
			trackSharks(sharks.current, state.current.monsters);
			drawFrame({
				ctx,
				...assets,
				map,
				state: state.current,
				tile,
				now,
				mySlot: start.you,
				showWalls: showWalls.current,
				sharks: sharks.current,
			});
			frame = requestAnimationFrame(draw);
		};
		frame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(frame);
	}, [assets, start]);

	// Leaves the match, or stops watching it.
	// Local: the server ends the match as if the time was over, and its game:end opens the WINNER screen
	function handleLeave() {
		if (mode !== "watch") {
			setLeaveConfirm(true);
			return;
		}

		socket.emit("game:unspectate");
		onEnd(null);
	}

	function confirmLeave() {
		socket.emit("game:leave");
    if (mode !== "local") {
		  onEnd(null);
    }
	}


	const leaveLabel = mode === "watch" ? t("game.stopWatching") : t("game.leave");

	if (error)
		return <p>{error}</p>;
	if (!assets)
		return <p>{t("game.loading")}</p>;
	return (
		<div className="game-screen">
			<canvas ref={canvasRef} />
			{countdown > 0 && <div className="countdown" key={countdown}>{countdown}</div>}
			{mode === "watch" && <p className="game-watching">{t("game.watching")}</p>}
			{!connected && <div className="reconnecting" role="status">{t("game.reconnecting")}</div>}
			{connected && (
				<button className="back-button game-leave" onClick={handleLeave} aria-label={leaveLabel} title={leaveLabel}>
					<BackIcon />
				</button>
			)}
			{touch && mode === "online" && <TouchControls send={sendCommand} />}
			{leaveConfirm && (
				<div className="leave-confirm-backdrop">
					<div
						className="leave-confirm"
						role="dialog"
						aria-modal="true"
						aria-labelledby="leave-confirm-title">
							<h2 id="leave-confirm-title">{t("game.leaveConfirmTitle")}</h2>
							<div className="button-row">
								<button className="sea-button" onClick={confirmLeave}>
									{t("common.yes")}
								</button>

								<button className="sea-button secondary" onClick={() => setLeaveConfirm(false)}>
									{t("common.no")}
								</button>
							</div>

					</div>
				</div>
			)}
		</div>
	);
}
