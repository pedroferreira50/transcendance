import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { User } from "../types/User";
import { api } from "../api";
import Screen from "./Screen";

type RegisterProps = {
    onLogin: () => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;
const PASSWORD_MIN_LENGTH = 8;

function Register({ onLogin }: RegisterProps) {
    const { t } = useTranslation();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [repeatPassword, setRepeatPassword] = useState("");
    const [message, setMessage] = useState("");

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

		const trimmedUsername = username.trim();
		const trimmedEmail = email.trim();

		if (trimmedUsername === "") {
			setMessage(t("auth.errors.usernameEmpty"));
			return;
		}

		if (!USERNAME_REGEX.test(trimmedUsername)) {
			setMessage(t("auth.errors.usernameInvalid"));
			return;
		}

		if (!EMAIL_REGEX.test(trimmedEmail)) {
			setMessage(t("auth.errors.emailInvalid"));
			return;
		}

		if (password === "") {
			setMessage(t("auth.errors.passwordEmpty"));
			return;
		}

		if (password.length < PASSWORD_MIN_LENGTH) {
			setMessage(t("auth.errors.passwordShort"));
			return;
		}

		if (password !== repeatPassword) {
			setMessage(t("auth.errors.passwordMismatch"));
			return;
		}

		const user: User = {
			username: trimmedUsername,
			email: trimmedEmail,
			password: password
		};

		try {
			const response = await api("/register", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(user)
			});

			const data = await response.json();

			setMessage(data.message);
		} catch (error) {
			console.error(error);
			setMessage(t("auth.errors.connect"));
		}
	}

    return (
        <Screen title={t("auth.registerTitle")} onBack={onLogin}>
            <form className="sea-form" onSubmit={handleSubmit} noValidate>
                <label className="sea-field">
                    {t("auth.username")}
                    <input
                        className="sea-input"
                        type="text"
                        autoComplete="username"
                        required
                        minLength={3}
                        maxLength={20}
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                    />
                </label>

                <label className="sea-field">
                    {t("auth.email")}
                    <input
                        className="sea-input"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </label>

                <label className="sea-field">
                    {t("auth.password")}
                    <input
                        className="sea-input"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={PASSWORD_MIN_LENGTH}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </label>

                <label className="sea-field">
                    {t("auth.repeatPassword")}
                    <input
                        className="sea-input"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={PASSWORD_MIN_LENGTH}
                        value={repeatPassword}
                        onChange={(event) =>
                            setRepeatPassword(event.target.value)
                        }
                    />
                </label>

                <p className="form-message" role="status">{message}</p>

                <button className="sea-button" type="submit">
                    {t("auth.register")}
                </button>

                <button className="sea-button secondary" type="button" onClick={onLogin}>
                    {t("auth.backToLogin")}
                </button>
            </form>
        </Screen>
    );
}

export default Register;
