import { io } from "socket.io-client";

// Same origin as the page: Vite proxies /socket.io in development and nginx in production.
export const socket = io({
    autoConnect: false,
    withCredentials: true
});

// Connects only if there is no connection yet. Calling socket.connect() while a
// connection is still opening sends a second "connect", and the server closes it
export function connectSocket() {
    if (!socket.active)
        socket.connect();
}
