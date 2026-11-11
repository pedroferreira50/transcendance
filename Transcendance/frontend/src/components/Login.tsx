import { useState } from "react";
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
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
	const [message, setMessage] = useState("");

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (username === "" || password === "") {
			setMessage("Username and password are required.");
			return;
		}

		try {
			const response = await api("/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					username,
					password
				})
			});

			const data = await response.json();

			setMessage(data.message);

			if (response.ok) {
				onLoginSuccess(
					username,
					data.wins,
					data.losses,
					data.multiplayerWins,
					data.multiplayerLosses
				);
			}
		} catch (error) {
			console.error(error);
			setMessage("Could not connect to server.");
		}
	}

    return (
        <Screen title="LOGIN" onBack={onBack}>
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
                    Password
                    <input
                        className="sea-input"
                        type="password"
                        autoComplete="current-password"
                        maxLength={128}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </label>

                <p className="form-message" role="status">{message}</p>

                <button className="sea-button" type="submit">
                    LOGIN
                </button>

                <button className="sea-button secondary" type="button" onClick={onRegister}>
                    SIGN UP
                </button>
            </form>
        </Screen>
    );
}

export default Login;