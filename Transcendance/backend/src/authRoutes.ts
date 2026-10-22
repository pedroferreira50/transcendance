import { Router } from "express";
import argon2 from "argon2";
import db from "./database";
import { setAuthCookie, clearAuthCookie, requireAuth } from "./auth";

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/register", async (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        res.status(400).json({
            message: "Username, email and password are required."
        });
        return;
    }

    if (typeof email !== "string" || email.length > 254 || !EMAIL_REGEX.test(email.trim())) {
        res.status(400).json({
            message: "Invalid email."
        });
        return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
        const passwordHash = await argon2.hash(password);

        const statement = db.prepare(`
            INSERT INTO users (username, email, password_hash)
            VALUES (?, ?, ?)
        `);

        statement.run(username, normalizedEmail, passwordHash);

        console.log(`User registered: ${username}`);

        res.status(201).json({
            message: "Registration successful!"
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("UNIQUE constraint failed: users.email")
        ) {
            res.status(409).json({
                message: "Email is already in use."
            });
            return;
        }

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

router.post("/login", async (req, res) => {
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

        setAuthCookie(res, user.id);

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

router.get("/me", requireAuth, (req, res) => {
    try {
        const statement = db.prepare(`
            SELECT username, wins, losses, multiplayer_wins, multiplayer_losses
            FROM users
            WHERE id = ?
        `);

        const user = statement.get(req.userId) as
            | {
                  username: string;
                  wins: number;
                  losses: number;
                  multiplayer_wins: number;
                  multiplayer_losses: number;
              }
            | undefined;

        if (!user) {
            clearAuthCookie(res);
            res.status(404).json({
                message: "User not found."
            });
            return;
        }

        res.json({
            username: user.username,
            wins: user.wins,
            losses: user.losses,
            multiplayerWins: user.multiplayer_wins,
            multiplayerLosses: user.multiplayer_losses
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not load user."
        });
    }
});

router.post("/logout", (req, res) => {
    clearAuthCookie(res);

    res.json({
        message: "Logged out."
    });
});

export default router;
