import { useState } from "react";
import loginBackground from "../assets/login-background.gif";

type LoginProps = {
    onRegister: () => void;
    onLoginSuccess: (
        username: string,
        wins: number,
        losses: number,
        multiplayerWins: number,
        multiplayerLosses: number
    ) => void;
};

function Login({ onRegister, onLoginSuccess }: LoginProps) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
	const [message, setMessage] = useState("");

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		try {
			const response = await fetch("http://localhost:3000/login", {
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
		}
	}

    return (
        <div style={{
            backgroundImage: `url(${loginBackground})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            height: "100vh"
        }}>
            <h1>Login</h1>

            <form
                onSubmit={handleSubmit}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}
            >
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                />

                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="submit">
                        Login
                    </button>

                    <button type="button" onClick={onRegister}>
                        Sign Up
                    </button>
                </div>
            </form>

			{message && <p>{message}</p>}
        </div>
    );
}

export default Login;