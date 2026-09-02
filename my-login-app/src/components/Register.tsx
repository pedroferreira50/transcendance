import { useState } from "react";
import type { User } from "../types/User";

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

    setMessage("Registration successful!");
	}

    return (
        <div>
            <h1>Register</h1>

            <form onSubmit={handleSubmit}>
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

                <button type="submit">
                    Register
                </button>
            </form>

            <p>{message}</p>

            <button onClick={onLogin}>
                Back to Login
            </button>
        </div>
    );
}

export default Register;