import { Router } from "express";
import argon2 from "argon2";
import db from "./database";
import prisma from "./prisma";
import { setAuthCookie, clearAuthCookie, requireAuth } from "./auth";
import { createRateLimiter } from "./rateLimit";

const router = Router();

const registerLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    code: "auth.rateLimitedRegister"
});

const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    code: "auth.rateLimitedLogin"
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[A-Za-z0-9_]{3,16}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

router.post("/register", registerLimiter, async (req, res) => {
    const { username, password, email } = req.body ?? {};

    if (
        typeof username !== "string" || username === "" ||
        typeof password !== "string" || password === "" ||
        typeof email !== "string" || email === ""
    ) {
        res.status(400).json({
            code: "auth.requiredFields"
        });
        return;
    }

    if (!USERNAME_REGEX.test(username)) {
        res.status(400).json({
            code: "auth.invalidUsername"
        });
        return;
    }

    if (email.length > 254 || !EMAIL_REGEX.test(email.trim())) {
        res.status(400).json({
            code: "auth.invalidEmail"
        });
        return;
    }

    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
        res.status(400).json({
            code: "auth.passwordLength",
            params: { min: PASSWORD_MIN, max: PASSWORD_MAX }
        });
        return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        res.status(400).json({
            code: "auth.passwordCharacters"
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
            code: "auth.registerSuccess"
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("UNIQUE constraint failed: users.email")
        ) {
            res.status(409).json({
                code: "auth.emailInUse"
            });
            return;
        }

        if (
            error instanceof Error &&
            error.message.includes("UNIQUE constraint failed")
        ) {
            res.status(409).json({
                code: "auth.usernameTaken"
            });
            return;
        }

        console.error(error);

        res.status(500).json({
            code: "auth.registerFailed"
        });
    }
});

router.post("/login", loginLimiter, async (req, res) => {
    const { username, password } = req.body ?? {};

    if (
        typeof username !== "string" || username === "" ||
        typeof password !== "string" || password === ""
    ) {
        res.status(400).json({
            code: "auth.loginRequiredFields"
        });
        return;
    }

    if (password.length > PASSWORD_MAX) {
        res.status(401).json({
            code: "auth.invalidCredentials"
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
                code: "auth.invalidCredentials"
            });
            return;
        }

        const passwordCorrect = await argon2.verify(
            user.password_hash,
            password
        );

        if (!passwordCorrect) {
            res.status(401).json({
                code: "auth.invalidCredentials"
            });
            return;
        }

        setAuthCookie(res, user.id);

        res.json({
            code: "auth.loginSuccess",
            id: user.id,
            username: user.username,
            wins: user.wins,
            losses: user.losses,
            multiplayerWins: user.multiplayer_wins,
            multiplayerLosses: user.multiplayer_losses
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            code: "auth.loginFailed"
        });
    }
});

router.get("/me", requireAuth, (req, res) => {
    try {
        const statement = db.prepare(`
            SELECT id, username, wins, losses, multiplayer_wins, multiplayer_losses
            FROM users
            WHERE id = ?
        `);

        const user = statement.get(req.userId) as
            | {
                  id: number;
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
            id: user.id,
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

router.get("/progression", requireAuth, async (req, res) => {
    const userId = req.userId;

    if (userId === undefined) {
        res.status(401).json({ message: "Not logged in." });
        return;
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                totalXp: true,
                achievements: {
                    select: {
                        achievementKey: true,
                        unlockedAt: true,
                    },
                },
                multiplayerWins: true,
            },
        });

        if (!user) {
            res.status(404).json({ message: "User not found." });
            return;
        }

        res.json({
            totalXp: user.totalXp,
            level: Math.floor(user.totalXp / 100) + 1,
            achievements: user.achievements,
            multiplayerWins: user.multiplayerWins,
            winsUntilTen: Math.max(0, 10 - user.multiplayerWins),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not load progression." });
    }
});

router.post("/logout", (req, res) => {
    clearAuthCookie(res);

    res.json({
        message: "Logged out."
    });
});

export default router;
