import { useState } from "react";
import type { User } from "../types/User";
import { api } from "../api";
import Screen from "./Screen";

type RegisterProps = {
    onLogin: () => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

		if (!EMAIL_REGEX.test(email.trim())) {
			setMessage("Please enter a valid email.");
			return;
		}

		if (password === "") {
			setMessage("Password cannot be empty.");
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