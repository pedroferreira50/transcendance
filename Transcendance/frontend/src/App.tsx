import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import OpenSea from "./components/OpenSea";
import LegalPage from "./components/LegalPage";
import CreditsPage from "./components/CreditsPage";
import type { Session } from "./types/Session";
import { api } from "./api";
import { socket } from "./socket";

// The two legal pages and the credits have their own URLs (/privacy, /terms and /credits), so they also work on a direct load
function legalPageFromPath(): "privacy" | "terms" | "credits" | null {
	const path = window.location.pathname.replace(/\/+$/, "");
	if (path === "/privacy")
		return "privacy";
	if (path === "/terms")
		return "terms";
	if (path === "/credits")
		return "credits";
	return null;
}

// The App keeps who is logged in (the session); which screen is open is kept by OpenSea
function App() {
	const { t } = useTranslation();
	const [session, setSession] = useState<Session | null>(null);
	const [checkingSession, setCheckingSession] = useState(true);
	const legalPage = legalPageFromPath();

	const refreshSession = useCallback(async () => {
		try {
			const response = await api("/me");

			if (response.ok) {
				setSession(await response.json());
			}
		} catch (error) {
			console.error(error);
		}
	}, []);

	useEffect(() => {
		async function checkSession() {
			await refreshSession();
			setCheckingSession(false);
		}

		checkSession();
	}, [refreshSession]);

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

	if (legalPage === "credits")
		return <CreditsPage />;
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
			onRefreshSession={refreshSession}
		/>
	);
}

export default App;
