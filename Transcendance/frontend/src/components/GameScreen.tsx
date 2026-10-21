import { useEffect, useRef, useState } from "react";
import { fixtureMap, fixtureState } from "../game/fixtureState";
import { createInput, type Command, type InputMode } from "../game/input";
import { drawFrame, trackSharks, type SharkMemory } from "../game/renderer";
import { loadMapImage, loadSprites, type Sprites } from "../game/sprites";
import TouchControls from "./TouchControls";

// The size the sprites and the map images were made at: never stretch them beyond it
const MAX_TILE = 64;

type Assets = {
	sprites: Sprites;
	mapImage: HTMLImageElement | null;
};

// TEMPORARY: without the server yet, the commands only go to the console (F12)
function logCommand(command: Command): void {
	console.log(command);
}

// The match screen. For now it draws the fake state (fixtureState), without the server
export default function GameScreen({ mode }: { mode: InputMode }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const showWalls = useRef(false);
	const sharks = useRef<SharkMemory>({ last: [], facing: [] });
	const [assets, setAssets] = useState<Assets | null>(null);
	const [error, setError] = useState<string | null>(null);
	// phones and tablets (the main way to point is a finger); it does not change while the screen is open
	const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);

	// Once, when the screen opens: load the sprites and the image of the map
	useEffect(() => {
		Promise.all([loadSprites(), loadMapImage(fixtureMap.name)])
			.then(([sprites, mapImage]) => setAssets({ sprites, mapImage }))
			.catch((err: Error) => setError(err.message));
	}, []);

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
	useEffect(() => 
		createInput(mode, logCommand)
	, [mode]);

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
			const map = fixtureMap;
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
			trackSharks(sharks.current, fixtureState.monsters);
			drawFrame({
				ctx,
				...assets,
				map,
				state: fixtureState,
				tile,
				now,
				mySlot: mode === "online" ? 0 : null, // online, in the fake state "I" am player 0
				showWalls: showWalls.current,
				sharks: sharks.current,
			});
			frame = requestAnimationFrame(draw);
		};
		frame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(frame);
	}, [assets, mode]);

	if (error)
		return <p>{error}</p>;
	if (!assets)
		return <p>Carregando...</p>;
	return (
		<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#000" }}>
			<canvas ref={canvasRef} />
			{touch && mode === "online" && <TouchControls send={logCommand} />}
		</div>
	);
}
