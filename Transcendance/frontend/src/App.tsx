import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import OpenSea from "./components/OpenSea";
import LegalPage from "./components/LegalPage";
import type { Session } from "./types/Session";
import { api } from "./api";
import { socket } from "./socket";

// The two legal pages have their own URLs (/privacy and /terms), so they also work on a direct load
function legalPageFromPath(): "privacy" | "terms" | null {
	const path = window.location.pathname.replace(/\/+$/, "");
	if (path === "/privacy")
		return "privacy";
	if (path === "/terms")
		return "terms";
	return null;
}

// The App keeps who is logged in (the session); which screen is open is kept by OpenSea
function App() {
	const { t } = useTranslation();
	const [session, setSession] = useState<Session | null>(null);
	const [checkingSession, setCheckingSession] = useState(true);
	const legalPage = legalPageFromPath();

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

	if (legalPage)
		return <LegalPage kind={legalPage} />;

	if (checkingSession) {
		return <p>{t("common.loading")}</p>;
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
