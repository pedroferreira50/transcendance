import { useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import Game from "./components/Game";
import Lobby from "./components/Lobby";
import type { MatchStart } from "./components/Lobby";
import MultiplayerGame from "./components/MultiplayerGame";

function App() {
    const [page, setPage] = useState<"login" | "register" | "dashboard" | "game" | "lobby" | "multiplayerGame">("login");
    const [username, setUsername] = useState("");
    const [soloWins, setSoloWins] = useState(0);
    const [soloLosses, setSoloLosses] = useState(0);
    const [multiplayerWins, setMultiplayerWins] = useState(0);
    const [multiplayerLosses, setMultiplayerLosses] = useState(0);
    const [match, setMatch] = useState<MatchStart | null>(null);

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
                onPlayMultiplayer={() => setPage("lobby")}
            />
        );
    }

    if (page === "lobby") {
        return (
            <Lobby
                username={username}
                onBack={() => setPage("dashboard")}
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