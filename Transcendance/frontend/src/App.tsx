import { useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import Game from "./components/Game";
import LobbySelect from "./components/LobbySelect";
import Lobby from "./components/Lobby";
import type { MatchStart, LobbyState } from "./components/Lobby";
import MultiplayerGame from "./components/MultiplayerGame";

function App() {
    const [page, setPage] = useState<"login" | "register" | "dashboard" | "game" | "lobbySelect" | "lobby" | "multiplayerGame">("login");
    const [username, setUsername] = useState("");
    const [soloWins, setSoloWins] = useState(0);
    const [soloLosses, setSoloLosses] = useState(0);
    const [multiplayerWins, setMultiplayerWins] = useState(0);
    const [multiplayerLosses, setMultiplayerLosses] = useState(0);
    const [match, setMatch] = useState<MatchStart | null>(null);
    const [lobby, setLobby] = useState<LobbyState | null>(null);

    if (page === "login") {
        return (
            <Login
                onRegister={() => setPage("register")}
                onLoginSuccess={(username, wins, losses, multiplayerWins, multiplayerLosses) => {
                    setUsername(username);
                    setSoloWins(wins);
                    setSoloLosses(losses);
                    setMultiplayerWins(multiplayerWins);
                    setMultiplayerLosses(multiplayerLosses);
                    setPage("dashboard");
                }}
            />
        );
    }

    if (page === "register") {
        return (
            <Register
                onLogin={() => setPage("login")}
            />
        );
    }

    if (page === "dashboard") {
        return (
            <Dashboard
                username={username}
                soloWins={soloWins}
                soloLosses={soloLosses}
                multiplayerWins={multiplayerWins}
                multiplayerLosses={multiplayerLosses}
                onLogout={() => setPage("login")}
                onPlaySolo={() => setPage("game")}
                onPlayMultiplayer={() => setPage("lobbySelect")}
            />
        );
    }

    if (page === "lobbySelect") {
        return (
            <LobbySelect
                username={username}
                onBack={() => setPage("dashboard")}
                onLobbyJoined={(lobby) => {
                    setLobby(lobby);
                    setPage("lobby");
                }}
            />
        );
    }

    if (page === "lobby" && lobby) {
        return (
            <Lobby
                initialLobby={lobby}
                onBack={() => setPage("lobbySelect")}
                onMatchStart={(match) => {
                    setMatch(match);
                    setPage("multiplayerGame");
                }}
            />
        );
    }

    if (page === "multiplayerGame" && match) {
        return (
            <MultiplayerGame
                match={match}
                onBack={() => setPage("dashboard")}
                onResult={(multiplayerWins, multiplayerLosses) => {
                    setMultiplayerWins(multiplayerWins);
                    setMultiplayerLosses(multiplayerLosses);
                }}
            />
        );
    }

    return (
        <Game
            onGameEnd={async (won) => {
                try {
                    const response = await fetch("http://localhost:3000/game-result", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ username, won })
                    });

                    const data = await response.json();

                    if (response.ok) {
                        setSoloWins(data.wins);
                        setSoloLosses(data.losses);
                    }
                } catch (error) {
                    console.error(error);
                }

                setPage("dashboard");
            }}
        />
    );
}

export default App;