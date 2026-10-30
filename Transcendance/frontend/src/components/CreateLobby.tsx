import { useEffect, useState } from "react";
import type { PlayerCount } from "../game/maps";
import { socket } from "../socket";
import type { LobbyState } from "./Lobby";
import MapSelect from "./MapSelect";
import Players from "./Players";

type CreateLobbyProps = {
	onBack: () => void;
	onCreated: (lobby: LobbyState) => void;
};

// Creating a lobby: PLAYERS -> MAP -> the server creates it with the two choices.
export default function CreateLobby({ onBack, onCreated }: CreateLobbyProps) {
	const [players, setPlayers] = useState<PlayerCount | null>(null);
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
	return (
		<MapSelect
			players={players}
			message={message}
			onChoose={(map) => socket.emit("lobby:create", { seats: players, map })}
			onBack={() => {
				setPlayers(null);
				setMessage("");
			}}
		/>
	);
}
