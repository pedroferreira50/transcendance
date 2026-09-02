import express from "express";
import cors from "cors";
import argon2 from "argon2";
import db from "./database";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

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
            message: "Login successful!"
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not log in."
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});