import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DynamicState, GameStart } from "../game/protocol";
import { socket } from "../socket";
import GameScreen from "./GameScreen";
import Winner from "./Winner";

type WatchGameProps = {
	start: GameStart;
	onBack: () => void;
	onExit: () => void;
};

// Shows another lobby's match, then its WINNER screen.
export default function WatchGame({ start, onBack, onExit }: WatchGameProps) {
	const { t } = useTranslation();
	const [result, setResult] = useState<DynamicState | null>(null);

	function handleMatchEnd(final: DynamicState | null) {
		if (final)
			setResult(final);
		else
			onBack();
	}

	function handleExit() {
		socket.disconnect();
		onExit();
	}

	if (result)
		return <Winner final={result} backLabel={t("winner.backToLobbies")} onBack={onBack} onExit={handleExit} />;
	return <GameScreen mode="watch" start={start} onEnd={handleMatchEnd} />;
}
