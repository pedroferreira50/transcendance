import { useEffect, useState } from "react";
import OpenSea from "./components/OpenSea";
import type { Session } from "./types/Session";
import { api } from "./api";
import { socket } from "./socket";

// The App keeps who is logged in (the session); which screen is open is kept by OpenSea
function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
        async function checkSession() {
            try {
                const response = await api("/me");

                if (response.ok) {
                    const data = await response.json();

                    setSession({
                        username: data.username,
                        wins: data.wins,
                        losses: data.losses,
                        multiplayerWins: data.multiplayerWins,
                        multiplayerLosses: data.multiplayerLosses
                    });
                }
            } catch (error) {
                console.error(error);
            }

            setCheckingSession(false);
        }

        checkSession();
    }, []);

    async function handleLogout() {
        try {
            await api("/logout", {
                method: "POST"
            });
        } catch (error) {
            console.error(error);
        }

        socket.disconnect();
        setSession(null);
    }

    if (checkingSession) {
        return <p>Loading...</p>;
    }

    return (
        <OpenSea
            session={session}
            onLogin={setSession}
            onLogout={handleLogout}
        />
    );
}

export default App;
