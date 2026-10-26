const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
    throw new Error("JWT_SECRET is missing. Copy backend/.env.example to backend/.env and set it.");
}

export const JWT_SECRET = jwtSecret;
export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
export const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
