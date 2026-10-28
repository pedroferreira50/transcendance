import { useState } from "react";
import Instructions from "./Instructions";
import Intro from "./Intro";
import Menu from "./Menu";

export type OpenSeaPage = "intro" | "menu" | "instructions";

type OpenSeaProps = {
	start?: OpenSeaPage; // the first screen (the intro when it does not come)
};

// Every Open Sea screen goes through here: it keeps which one is open and where each button leads
export default function OpenSea({ start = "intro" }: OpenSeaProps) {
	const [page, setPage] = useState<OpenSeaPage>(start);

	if (page === "intro")
		return <Intro onPlay={() => setPage("menu")} />;
	if (page === "instructions")
		return <Instructions onBack={() => setPage("menu")} />;
	return (
		<Menu
			onChoose={(choice) => {
				if (choice === "instructions")
					setPage("instructions");
				else
					console.log(choice); // TEMPORARY: local and online come with their screens
			}}
			onBack={() => setPage("intro")} // to read the story again
		/>
	);
}
