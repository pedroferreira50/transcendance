import type { Server, Socket } from "socket.io";
import db from "./database";
import { tokenFromCookieHeader, verifyToken } from "./auth";

export function setupSocketAuth(io: Server) {
    io.use((socket, next) => {
        const token = tokenFromCookieHeader(socket.handshake.headers.cookie);
        const userId = token ? verifyToken(token) : null;

        if (userId === null) {
            next(new Error("Not logged in."));
            return;
        }

        try {
            const statement = db.prepare(`
                SELECT username FROM users
                WHERE id = ?
            `);

            const user = statement.get(userId) as { username: string } | undefined;

            if (!user) {
                next(new Error("User not found."));
                return;
            }

            socket.data.userId = userId;
            socket.data.username = user.username;
            next();
        } catch (error) {
            console.error(error);
            next(new Error("Could not authenticate."));
        }
    });
}

// One game connection per user: the same account opened in another browser
// (or tab) takes the place of the old connection, which is told why and closed.
// Closing it is the same as closing that browser: it leaves its lobby and match.
export function setupOneConnectionPerUser(io: Server) {
    const connections = new Map<number, Socket>(); // userId -> their connection

    io.on("connection", (socket: Socket) => {
        const userId: number = socket.data.userId;
        const old = connections.get(userId);

        if (old) {
            old.emit("session:replaced");
            old.disconnect();
        }

        connections.set(userId, socket);

        socket.on("disconnect", () => {
            // only if it was not replaced already (the new one stays)
            if (connections.get(userId) === socket) {
                connections.delete(userId);
            }
        });
    });
}
