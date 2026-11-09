import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import Screen from "./Screen";

type LoginProps = {
    onBack: () => void;
    onRegister: () => void;
    onLoginSuccess: (
        username: string,
        wins: number,
        losses: number,
        multiplayerWins: number,
        multiplayerLosses: number
    ) => void;
};

function Login({ onBack, onRegister, onLoginSuccess }: LoginProps) {
    const { t } = useTranslation();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
	const [message, setMessage] = useState("");

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (username.trim() === "") {
			setMessage(t("auth.errors.usernameEmpty"));
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
					username: username.trim(),
					password
				})
			});

			const data = await response.json();

			setMessage(data.message);

			if (response.ok) {
				onLoginSuccess(
					username.trim(),
					data.wins,
					data.losses,
					data.multiplayerWins,
					data.multiplayerLosses
				);
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
                    {t("auth.username")}
                    <input
                        className="sea-input"
                        type="text"
                        autoComplete="username"
                        required
                        maxLength={20}
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                    />
                </label>

                <label className="sea-field">
                    {t("auth.password")}
                    <input
                        className="sea-input"
                        type="password"
                        autoComplete="current-password"
                        required
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
