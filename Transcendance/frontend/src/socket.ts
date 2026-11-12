import { io } from "socket.io-client";

// Same origin as the page: Vite proxies /socket.io in development and nginx in production.
export const socket = io({
    autoConnect: false,
    withCredentials: true
});
