import { useEffect, useState } from "react";
import type { PlayerCount } from "../game/maps";
import { defaultOptions } from "../game/options";
import { socket } from "../socket";
import type { LobbyState } from "./Lobby";
import MapSelect from "./MapSelect";
import Options from "./Options";
import Players from "./Players";

type CreateLobbyProps = {
	onBack: () => void;
	onCreated: (lobby: LobbyState) => void;
};

// Creating a lobby: PLAYERS -> MAP -> OPTIONS -> the server creates it with the three choices.
export default function CreateLobby({ onBack, onCreated }: CreateLobbyProps) {
	const [players, setPlayers] = useState<PlayerCount | null>(null);
	const [map, setMap] = useState<string | null>(null);
	const [message, setMessage] = useState("");

	useEffect(() => {
		socket.connect(); // already connected by the LOBBIES screen: then it does nothing
		socket.on("lobby:joined", onCreated);
		socket.on("lobby:error", setMessage);
		return () => {
			socket.off("lobby:joined", onCreated);
			socket.off("lobby:error", setMessage);
		};
	}, [onCreated]);

	if (players === null)
		return <Players onChoose={setPlayers} onBack={onBack} />;
	if (map === null)
		return <MapSelect players={players} onChoose={setMap} onBack={() => setPlayers(null)} />;
	return (
		<Options
			initial={defaultOptions()}
			confirmLabel="CREATE"
			message={message}
			onChoose={(options) => socket.emit("lobby:create", { seats: players, map, options })}
			onBack={() => {
				setMap(null);
				setMessage("");
			}}
		/>
	);
}
