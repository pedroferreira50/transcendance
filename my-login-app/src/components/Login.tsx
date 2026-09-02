import { useState } from "react";

type LoginProps = {
    onRegister: () => void;
};

function Login({ onRegister }: LoginProps) {
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
			<p>{message}</p>
		} catch (error) {
			console.error(error);
		}
	}

    return (
        <div>
            <h1>Login</h1>

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

                <button type="submit">
                    Login
                </button>
            </form>

			{message && <p>{message}</p>}

            <button onClick={onRegister}>
                Sign Up
            </button>
        </div>
    );
}

export default Login;