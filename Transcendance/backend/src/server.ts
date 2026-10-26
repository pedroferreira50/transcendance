import { FRONTEND_ORIGIN } from "./config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import db from "./database";
import { setupLobby } from "./lobby";
import authRoutes from "./authRoutes";
import { setupSocketAuth } from "./socketAuth";
import { requireAuth } from "./auth";

const app = express();
const PORT = 3000;

app.use(cors({
    origin: FRONTEND_ORIGIN,
    credentials: true
}));
app.use(express.json());
app.use(authRoutes);

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: FRONTEND_ORIGIN,
        credentials: true
    }
});

setupSocketAuth(io);
setupLobby(io);

app.post("/game-result", requireAuth, (req, res) => {
    const { won } = req.body;

    if (typeof won !== "boolean") {
        res.status(400).json({
            message: "Won is required."
        });
        return;
    }

    try {
        const column = won ? "wins" : "losses";

        const statement = db.prepare(`
            UPDATE users SET ${column} = ${column} + 1 WHERE id = ?
        `);

        const result = statement.run(req.userId);

        if (result.changes === 0) {
            res.status(404).json({
                message: "User not found."
            });
            return;
        }

        const updated = db
            .prepare(`SELECT wins, losses FROM users WHERE id = ?`)
            .get(req.userId) as { wins: number; losses: number };

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