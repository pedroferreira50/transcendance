import type { CSSProperties } from "react";

// Where one image goes: left and top in % of the screen, width in % of the width of the screen
type Place = {
	left: number;
	top: number;
	width: number;
};

// One image of the scenery: its place on computers (a 16:9 screen) and, if it also shows on phones
// standing up, its place there. flip: the image facing the other side
export type Decoration = Place & {
	art: string;
	phone?: Place;
	flip?: boolean;
};

// The images around the content of a screen (the shark, the turtle, the bubbles...).
// The places go to the CSS as variables (--left, --phone-left...): the CSS picks one set or the other
// for the size of the screen (Screen.css). On computers the width also follows the height (16/9 of it):
// on a screen less wide than 16:9 the images do not grow too much
export default function Decorations({ items }: { items: Decoration[] }) {
	return (
		<div className="decorations">
			{items.map((item) => {
				const place: Record<string, string> = {
					"--left": `${item.left}%`,
					"--top": `${item.top}%`,
					"--width": `min(${item.width}vw, ${(item.width * 16) / 9}vh)`,
					"--flip": item.flip ? "scaleX(-1)" : "none",
				};
				if (item.phone) {
					place["--phone-left"] = `${item.phone.left}%`;
					place["--phone-top"] = `${item.phone.top}%`;
					place["--phone-width"] = `${item.phone.width}vw`;
				}
				return (
					<img
						key={`${item.art}-${item.left}-${item.top}`}
						className={item.phone ? "decoration on-phone" : "decoration"}
						src={`/art/${item.art}.webp`}
						alt=""
						style={place as CSSProperties}
					/>
				);
			})}
		</div>
	);
}
