import type { Server } from "socket.io";
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
