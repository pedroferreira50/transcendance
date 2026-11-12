import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { socket } from "../socket";
import type { DynamicState, GameStart } from "../game/protocol";
import type { Session } from "../types/Session";
import CreateLobby from "./CreateLobby";
import GameScreen from "./GameScreen";
import Instructions from "./Instructions";
import Intro from "./Intro";
import Lobby, { type LobbyState } from "./Lobby";
import LocalGame from "./LocalGame";
import LobbySelect from "./LobbySelect";
import Login from "./Login";
import Menu from "./Menu";
import Profile from "./Profile";
import Register from "./Register";
import WatchGame from "./WatchGame";
import Winner from "./Winner";

export type OpenSeaPage = "intro" | "menu" | "instructions" | "login" | "register" | "profile" | "lobbies" | "create" | "lobby" | "local" | "watch";

type OpenSeaProps = {
	session: Session | null; // null: nobody logged in
	onLogin: (session: Session) => void;
	onLogout: () => void;
	onRefreshSession: () => Promise<void>;
};

// Every Open Sea screen goes through here: it keeps which one is open and where each button leads.
// Who is logged in is kept by App.tsx: it comes in session, and the login and the logout go back to it
export default function OpenSea({ session, onLogin, onLogout, onRefreshSession }: OpenSeaProps) {
	const { t } = useTranslation();
	const [page, setPage] = useState<OpenSeaPage>("intro");
	// the screen that asked for the login: after it, the player goes there
	const [afterLogin, setAfterLogin] = useState<OpenSeaPage>("menu");
	const [lobby, setLobby] = useState<LobbyState | null>(null);
	const [watching, setWatching] = useState<GameStart | null>(null);
	// what the menu tells when the player was sent back to it ("" = nothing)
	const [notice, setNotice] = useState("");
	// a match that came back (game:resume, after an F5 or a dropped connection), over any screen
	const [resumed, setResumed] = useState<GameStart | null>(null);
	const [resumedEnd, setResumedEnd] = useState<DynamicState | null>(null); // its game:end: the WINNER screen

	// logged in: the socket connects now, and not only on LOBBIES or PLAY LOCAL,
	// so after an F5 the server can send game:resume if a match of this user is still running
	useEffect(() => {
		if (session)
			socket.connect();
	}, [session]);

	// the same account opened Open Sea somewhere else: the server closed this connection
	// (the match goes on in the new window), so this window goes back to the menu and says why
	useEffect(() => {
		function handleReplaced() {
			setLobby(null);
			setResumed(null);
			setResumedEnd(null);
			setNotice(t("menu.replaced"));
			setPage("menu");
		}

		function handleResume(match: GameStart) {
			setResumedEnd(null);
			setResumed(match);
		}

		// back online, but the server has no match for this player, and took them out of any lobby room
		function handleGone() {
			setLobby(null);
		}

		socket.on("session:replaced", handleReplaced);
		socket.on("game:resume", handleResume);
		socket.on("game:gone", handleGone);
		// the room of a match that came back: Lobby is closed during it, so its changes are kept here
		socket.on("lobby:resume", setLobby);
		socket.on("lobby:update", setLobby);
		return () => {
			socket.off("session:replaced", handleReplaced);
			socket.off("game:resume", handleResume);
			socket.off("game:gone", handleGone);
			socket.off("lobby:resume", setLobby);
			socket.off("lobby:update", setLobby);
		};
	}, [t]);

	// the resumed match is over (final = game:end), or it was left with the « or is gone (final = null)
	function handleResumedEnd(final: DynamicState | null) {
		if (final)
			setResumedEnd(final);
		else
			closeResumed(resumed && resumed.local ? "local" : "lobby");
	}

	// out of the resumed match: online back to its lobby room, local back to the choice of the map and the fish
	function closeResumed(next: OpenSeaPage) {
		setResumed(null);
		setResumedEnd(null);
		if (next !== "lobby")
			setLobby(null);
		setPage(next);
	}

	// screens that need a login: without one, the login comes first and then the screen
	const openWithLogin = (next: OpenSeaPage) => {
		if (session)
			setPage(next);
		else {
			setAfterLogin(next);
			setPage("login");
		}
	};

	if (resumed && resumedEnd)
		return (
			<Winner
				final={resumedEnd}
				backLabel={resumed.local ? t("winner.playAgain") : lobby ? undefined : t("lobby.lobbies")}
				onBack={() => closeResumed(resumed.local ? "local" : "lobby")}
				onExit={() => {
					if (lobby)
						socket.emit("lobby:leave");
					closeResumed("menu");
				}}
			/>
		);
	if (resumed)
		return <GameScreen mode={resumed.local ? "local" : "online"} start={resumed} onEnd={handleResumedEnd} />;
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
	// page "lobby" without a lobby: the room is gone, so the player chooses another one
	if ((page === "lobbies" || (page === "lobby" && !lobby)) && session)
		return (
			<LobbySelect
				onBack={() => setPage("menu")}
				onCreate={() => setPage("create")}
				onLobbyJoined={(joined) => {
					setLobby(joined);
					setPage("lobby");
				}}
				onWatch={(start) => {
					setWatching(start);
					setPage("watch");
				}}
			/>
		);
	if (page === "watch" && session && watching)
		return (
			<WatchGame
				start={watching}
				onBack={() => {
					setWatching(null);
					setPage("lobbies");
				}}
				onExit={() => {
					setWatching(null);
					setPage("menu");
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
	// PLAY LOCAL: the map, the two fish and the match on this keyboard
	if (page === "local" && session)
		return <LocalGame onExit={() => setPage("menu")} />;
	// the lobby room (and the match, that opens inside it)
	if (page === "lobby" && session && lobby)
		return <Lobby initialLobby={lobby} onBack={() => setPage("lobbies")} />;
	let menuUsername: string | null = null;
	if (session !== null)
		menuUsername = session.username;
	return (
		<Menu
			username={menuUsername}
			notice={notice}
			onChoose={(choice) => {
				setNotice("");
				if (choice === "instructions")
					setPage("instructions");
				else if (choice === "online")
					openWithLogin("lobbies");
				else
					openWithLogin("local");
			}}
			onAccount={() => {
				setNotice("");
				if (session) {
					void onRefreshSession().finally(() => setPage("profile"));
				} else {
					openWithLogin("profile");
				}
			}}
			onBack={() => {
				setNotice("");
				setPage("intro"); // to read the story again
			}}
		/>
	);
}
