import { useEffect, useState } from "react";
import { socket } from "../socket";
import type { Session } from "../types/Session";
import CreateLobby from "./CreateLobby";
import Instructions from "./Instructions";
import Intro from "./Intro";
import Lobby, { type LobbyState } from "./Lobby";
import LobbySelect from "./LobbySelect";
import Login from "./Login";
import Menu from "./Menu";
import Profile from "./Profile";
import Register from "./Register";

export type OpenSeaPage = "intro" | "menu" | "instructions" | "login" | "register" | "profile" | "lobbies" | "create" | "lobby";

type OpenSeaProps = {
	session: Session | null; // null: nobody logged in
	onLogin: (session: Session) => void;
	onLogout: () => void;
};

// Every Open Sea screen goes through here: it keeps which one is open and where each button leads.
// Who is logged in is kept by App.tsx: it comes in session, and the login and the logout go back to it
export default function OpenSea({ session, onLogin, onLogout }: OpenSeaProps) {
	const [page, setPage] = useState<OpenSeaPage>("intro");
	// the screen that asked for the login: after it, the player goes there
	const [afterLogin, setAfterLogin] = useState<OpenSeaPage>("menu");
	const [lobby, setLobby] = useState<LobbyState | null>(null);
	// what the menu tells when the player was sent back to it ("" = nothing)
	const [notice, setNotice] = useState("");

	// the same account opened Open Sea somewhere else: the server closed this connection
	// (it left the lobby and the match), so this window goes back to the menu and says why
	useEffect(() => {
		function handleReplaced() {
			setLobby(null);
			setNotice("Open Sea was opened in another window.");
			setPage("menu");
		}

		socket.on("session:replaced", handleReplaced);
		return () => {
			socket.off("session:replaced", handleReplaced);
		};
	}, []);

	// screens that need a login: without one, the login comes first and then the screen
	const openWithLogin = (next: OpenSeaPage) => {
		if (session)
			setPage(next);
		else {
			setAfterLogin(next);
			setPage("login");
		}
	};

	if (page === "intro")
		return <Intro onPlay={() => setPage("menu")} />;
	if (page === "instructions")
		return <Instructions onBack={() => setPage("menu")} />;
	if (page === "login")
		return (
			<Login
				onBack={() => setPage("menu")}
				onRegister={() => setPage("register")}
				onLoginSuccess={(username, wins, losses, multiplayerWins, multiplayerLosses) => {
					onLogin({ username, wins, losses, multiplayerWins, multiplayerLosses });
					setPage(afterLogin);
				}}
			/>
		);
	if (page === "register")
		return <Register onLogin={() => setPage("login")} />;
	if (page === "profile" && session)
		return (
			<Profile
				username={session.username}
				multiplayerWins={session.multiplayerWins}
				multiplayerLosses={session.multiplayerLosses}
				onBack={() => setPage("menu")}
				onLogout={() => {
					onLogout();
					setPage("menu");
				}}
			/>
		);
	if (page === "lobbies" && session)
		return (
			<LobbySelect
				onBack={() => setPage("menu")}
				onCreate={() => setPage("create")}
				onLobbyJoined={(joined) => {
					setLobby(joined);
					setPage("lobby");
				}}
			/>
		);
	if (page === "create" && session)
		return (
			<CreateLobby
				onBack={() => setPage("lobbies")}
				onCreated={(created) => {
					setLobby(created);
					setPage("lobby");
				}}
			/>
		);
	// the lobby room (and the match, that opens inside it)
	if (page === "lobby" && session && lobby)
		return <Lobby initialLobby={lobby} onBack={() => setPage("lobbies")} />;
	return (
		<Menu
			username={session ? session.username : null}
			notice={notice}
			onChoose={(choice) => {
				setNotice("");
				if (choice === "instructions")
					setPage("instructions");
				else if (choice === "online")
					openWithLogin("lobbies");
				else
					console.log(choice); // TEMPORARY: the local mode comes in the Etapa 5
			}}
			onAccount={() => {
				setNotice("");
				openWithLogin("profile");
			}}
			onBack={() => {
				setNotice("");
				setPage("intro"); // to read the story again
			}}
		/>
	);
}
