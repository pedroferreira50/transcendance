import { useState } from "react";
import type { User } from "../types/User";
import loginBackground from "../assets/login-background.gif";

type RegisterProps = {
    onLogin: () => void;
};

function Register({ onLogin }: RegisterProps) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [repeatPassword, setRepeatPassword] = useState("");
    const [message, setMessage] = useState("");

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

		if (username === "") {
			setMessage("Username cannot be empty.");
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
			password: password
		};

		try {
			const response = await fetch("http://localhost:3000/register", {
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
        <div style={{
            backgroundImage: `url(${loginBackground})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            height: "100vh"
        }}>
            <h1>Register</h1>

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

                <input
                    type="password"
                    placeholder="Repeat password"
                    value={repeatPassword}
                    onChange={(event) =>
                        setRepeatPassword(event.target.value)
                    }
                />

                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="submit">
                        Register
                    </button>

                    <button type="button" onClick={onLogin}>
                        Back to Login
                    </button>
                </div>
            </form>

            <p>{message}</p>
        </div>
    );
}

export default Register;