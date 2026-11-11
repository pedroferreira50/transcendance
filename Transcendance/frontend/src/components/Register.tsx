import { useState } from "react";
import type { User } from "../types/User";
import { api } from "../api";
import Screen from "./Screen";

type RegisterProps = {
    onLogin: () => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[A-Za-z0-9_]{3,16}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function Register({ onLogin }: RegisterProps) {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [repeatPassword, setRepeatPassword] = useState("");
    const [message, setMessage] = useState("");

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

		if (username === "") {
			setMessage("Username cannot be empty.");
			return;
		}

		if (!USERNAME_REGEX.test(username)) {
			setMessage("Username must be 3 to 16 characters, using only letters, numbers and _.");
			return;
		}

		if (email.length > 254 || !EMAIL_REGEX.test(email.trim())) {
			setMessage("Please enter a valid email.");
			return;
		}

		if (password === "") {
			setMessage("Password cannot be empty.");
			return;
		}

		if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
			setMessage(`Password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`);
			return;
		}

		if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
			setMessage("Password must contain at least one letter and one number.");
			return;
		}

		if (password !== repeatPassword) {
			setMessage("Passwords do not match.");
			return;
		}

		const user: User = {
			username: username,
			email: email.trim(),
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
			setMessage("Could not connect to server.");
		}
	}

    return (
        <Screen title="REGISTER" onBack={onLogin}>
            <form className="sea-form" onSubmit={handleSubmit}>
                <label className="sea-field">
                    Username
                    <input
                        className="sea-input"
                        type="text"
                        autoComplete="username"
                        maxLength={16}
                        placeholder="3-16 letters, numbers or _"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                    />
                </label>

                <label className="sea-field">
                    Email
                    <input
                        className="sea-input"
                        type="text"
                        autoComplete="email"
                        maxLength={254}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </label>

                <label className="sea-field">
                    Password
                    <input
                        className="sea-input"
                        type="password"
                        autoComplete="new-password"
                        maxLength={PASSWORD_MAX}
                        placeholder="8+ characters, a letter and a number"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </label>

                <label className="sea-field">
                    Repeat password
                    <input
                        className="sea-input"
                        type="password"
                        autoComplete="new-password"
                        maxLength={PASSWORD_MAX}
                        value={repeatPassword}
                        onChange={(event) =>
                            setRepeatPassword(event.target.value)
                        }
                    />
                </label>

                <p className="form-message" role="status">{message}</p>

                <button className="sea-button" type="submit">
                    REGISTER
                </button>

                <button className="sea-button secondary" type="button" onClick={onLogin}>
                    BACK TO LOGIN
                </button>
            </form>
        </Screen>
    );
}

export default Register;