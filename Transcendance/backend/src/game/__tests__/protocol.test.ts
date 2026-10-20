import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const BACKEND = path.join(__dirname, "..", "types.ts");
const FRONTEND = path.join(__dirname, "..", "..", "..", "..", "frontend", "src", "game", "protocol.ts");

// name -> text of each "export type", without comments and with the spaces squeezed
function declarations(file: string): Map<string, string> {
	const lines = fs.readFileSync(file, "utf8").split("\n").map((line) => line.replace(/\/\/.*/, ""));
	const result = new Map<string, string>();
	for (let i = 0; i < lines.length; i++) {
		const name = lines[i].match(/^export type (\w+)/)?.[1];
		if (!name)
			continue;
		let text = lines[i];
		while (!/;\s*$/.test(lines[i]) || depth(text) > 0)
			text += " " + lines[++i];
		result.set(name, text.replace(/\s+/g, " ").replace(/\s*;?\s*}/g, " }").trim());
	}
	return result;
}

function depth(text: string): number {
	return (text.match(/{/g) ?? []).length - (text.match(/}/g) ?? []).length;
}

test("frontend protocol.ts is an exact copy of the types in types.ts", () => {
	const backend = declarations(BACKEND);
	const frontend = declarations(FRONTEND);
	expect(frontend.size).toBeGreaterThan(0);
	for (const [name, text] of frontend)
		expect(backend.get(name), `type ${name}`).toBe(text);
});
