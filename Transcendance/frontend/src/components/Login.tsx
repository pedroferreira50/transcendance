import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { localizedError } from "../i18n";
import type { Session } from "../types/Session";
import Screen from "./Screen";

type LoginProps = {
    onBack: () => void;
    onRegister: () => void;
    onLoginSuccess: (session: Session) => void;
};

function Login({ onBack, onRegister, onLoginSuccess }: LoginProps) {
    const { t } = useTranslation();
    const [identifier, setIdentifier] = useState(""); // the username or the email
    const [password, setPassword] = useState("");
	const [message, setMessage] = useState("");

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (identifier.trim() === "") {
			setMessage(t("auth.errors.usernameOrEmailEmpty"));
			return;
		}

		if (password === "") {
			setMessage(t("auth.errors.passwordEmpty"));
			return;
		}

		try {
			const response = await api("/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					identifier: identifier.trim(),
					password
				})
			});

			const data = await response.json();

			setMessage(localizedError(t, data));

			if (response.ok) {
				onLoginSuccess({
					id: data.id,
					username: data.username,
					wins: data.wins,
					losses: data.losses,
					multiplayerWins: data.multiplayerWins,
					multiplayerLosses: data.multiplayerLosses
				});
			}
		} catch (error) {
			console.error(error);
			setMessage(t("auth.errors.connect"));
		}
	}

    return (
        <Screen title={t("auth.loginTitle")} onBack={onBack}>
            <form className="sea-form" onSubmit={handleSubmit} noValidate>
                <label className="sea-field">
                    {t("auth.usernameOrEmail")}
                    <input
                        className="sea-input"
                        type="text"
                        autoComplete="username"
                        required
                        maxLength={254}
                        value={identifier}
                        onChange={(event) => setIdentifier(event.target.value)}
                    />
                </label>

                <label className="sea-field">
                    {t("auth.password")}
                    <input
                        className="sea-input"
                        type="password"
                        autoComplete="current-password"
                        required
                        maxLength={128}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </label>

                <p className="form-message" role="status">{message}</p>

                <button className="sea-button" type="submit">
                    {t("auth.login")}
                </button>

                <button className="sea-button secondary" type="button" onClick={onRegister}>
                    {t("auth.signup")}
                </button>
            </form>
        </Screen>
    );
}

export default Login;
