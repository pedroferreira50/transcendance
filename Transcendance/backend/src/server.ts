import { FRONTEND_ORIGIN } from "./config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { setupLobby } from "./lobby";
import authRoutes from "./authRoutes";
import { setupOneConnectionPerUser, setupSocketAuth } from "./socketAuth";
import { GameManager, ioTransport } from "./game/GameManager";
import { setupGameSocket } from "./game/gameSocket";

const app = express();
const PORT = 3000;

// Behind nginx: req.ip must be the browser, not the proxy container
app.set("trust proxy", 1);

app.use(cors({
    origin: FRONTEND_ORIGIN,
    credentials: true
}));
app.use(express.json());
app.use("/api", authRoutes);

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: FRONTEND_ORIGIN,
        credentials: true
    }
});

// The only GameManager: every online match of the server
const games = new GameManager(ioTransport(io));

setupSocketAuth(io);
setupOneConnectionPerUser(io);
setupLobby(io, games);
setupGameSocket(io, games);

httpServer.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});