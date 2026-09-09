import express from "express";
import cors from "cors";
import argon2 from "argon2";
import { createServer } from "http";
import { Server } from "socket.io";
import db from "./database";
import { setupLobby } from "./lobby";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*"
    }
});

setupLobby(io);

app.post("/register", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({
            message: "Username and password are required."
        });
        return;
    }

    try {
        const passwordHash = await argon2.hash(password);

        const statement = db.prepare(`
            INSERT INTO users (username, password_hash)
            VALUES (?, ?)
        `);

        statement.run(username, passwordHash);

        console.log(`User registered: ${username}`);

        res.status(201).json({
            message: "Registration successful!"
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("UNIQUE constraint failed")
        ) {
            res.status(409).json({
                message: "Username is already taken."
            });
            return;
        }

        console.error(error);

        res.status(500).json({
            message: "Could not register user."
        });
    }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({
            message: "Username and password are required."
        });
        return;
    }

    try {
        const statement = db.prepare(`
            SELECT * FROM users
            WHERE username = ?
        `);

        const user = statement.get(username) as
            | {
                  id: number;
                  username: string;
                  password_hash: string;
                  wins: number;
                  losses: number;
                  multiplayer_wins: number;
                  multiplayer_losses: number;
              }
            | undefined;

        if (!user) {
            res.status(401).json({
                message: "Invalid username or password."
            });
            return;
        }

        const passwordCorrect = await argon2.verify(
            user.password_hash,
            password
        );

        if (!passwordCorrect) {
            res.status(401).json({
                message: "Invalid username or password."
            });
            return;
        }

        res.json({
            message: "Login successful!",
            wins: user.wins,
            losses: user.losses,
            multiplayerWins: user.multiplayer_wins,
            multiplayerLosses: user.multiplayer_losses
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not log in."
        });
    }
});

app.post("/game-result", (req, res) => {
    const { username, won } = req.body;

    if (!username || typeof won !== "boolean") {
        res.status(400).json({
            message: "Username and won are required."
        });
        return;
    }

    try {
        const column = won ? "wins" : "losses";

        const statement = db.prepare(`
            UPDATE users SET ${column} = ${column} + 1 WHERE username = ?
        `);

        const result = statement.run(username);

        if (result.changes === 0) {
            res.status(404).json({
                message: "User not found."
            });
            return;
        }

        const updated = db
            .prepare(`SELECT wins, losses FROM users WHERE username = ?`)
            .get(username) as { wins: number; losses: number };

        res.json({
            message: "Game result recorded.",
            wins: updated.wins,
            losses: updated.losses
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not record game result."
        });
    }
});

httpServer.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});