// Loads every image of the game before the first frame
import type { Character, PowerUpType } from "./protocol";

// name ("goldfish-right", "diamonds-5/3"...) -> image already loaded
export type Sprites = Record<string, HTMLImageElement>;

const CHARACTERS: Character[] = ["goldfish", "betta", "angler", "puffer"];
const POWERUPS: PowerUpType[] = ["speed", "freeze", "enchant"];
const SHARKS = ["shark", "shark-frozen", "shark-enchanted"];

// The names of all the files in public/sprites/ that the game uses (without ".webp")
function spriteNames(): string[] {
	const names = ["exit-turtle", "item-diamond", "icon-diamond", "bubble"];
	for (const character of CHARACTERS)
		names.push(`${character}-left`, `${character}-right`, `portrait-${character}`);
	for (const shark of SHARKS)
		names.push(`${shark}-left`, `${shark}-right`);
	for (const powerUp of POWERUPS)
		names.push(`item-${powerUp}`, `icon-${powerUp}`);
	for (let n = 0; n <= 5; n++)
		names.push(`diamonds-5/${n}`);
	for (let n = 0; n <= 10; n++)
		names.push(`diamonds-10/${n}`);
	return names;
}

// One image: the Promise ends when the browser has finished loading it
function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error(`could not load ${src}`));
		image.src = src;
	});
}

// All the images at the same time; ends when the last one is loaded
// async function:  is a special type of function that always returns a 'Promise'
// await:  is used to pause the execution of an asynchronous function until a ‘Promise’ is resolved or rejected
export async function loadSprites(): Promise<Sprites> {
	const names = spriteNames();
	const images = await Promise.all(names.map((name) => loadImage(`/sprites/${name}.webp`)));
	const sprites: Sprites = {};
	for (let i = 0; i < names.length; i++)
		sprites[names[i]] = images[i];
	return sprites;
}

// Maps that already have their image in public/maps/ (asking for one that does not exist = 404 error in the console)
const MAPS_WITH_IMAGE = ["small-1"];

// The background of the map, or null if it has no image yet (then the map is drawn in blocks)
export async function loadMapImage(name: string): Promise<HTMLImageElement | null> {
	if (!MAPS_WITH_IMAGE.includes(name))
		return null;
	return loadImage(`/maps/${name}.webp`);
}
