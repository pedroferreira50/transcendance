import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { parseCookie } from "cookie";
import { JWT_SECRET, COOKIE_SECURE } from "./config";

declare global {
    namespace Express {
        interface Request {
            userId?: number;
        }
    }
}

const COOKIE_NAME = "token";
const TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: COOKIE_SECURE,
    path: "/"
};

export function signToken(userId: number): string {
    return jwt.sign({ userId }, JWT_SECRET, {
        algorithm: "HS256",
        expiresIn: TOKEN_LIFETIME_SECONDS
    });
}

export function verifyToken(token: string): number | null {
    try {
        const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });

        if (typeof payload === "object" && typeof payload.userId === "number") {
            return payload.userId;
        }

        return null;
    } catch {
        return null;
    }
}

export function setAuthCookie(res: Response, userId: number) {
    res.cookie(COOKIE_NAME, signToken(userId), {
        ...cookieOptions,
        maxAge: TOKEN_LIFETIME_SECONDS * 1000
    });
}

export function clearAuthCookie(res: Response) {
    res.clearCookie(COOKIE_NAME, cookieOptions);
}

export function tokenFromCookieHeader(header: string | undefined): string | undefined {
    if (!header) {
        return undefined;
    }

    return parseCookie(header)[COOKIE_NAME];
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token = tokenFromCookieHeader(req.headers.cookie);
    const userId = token ? verifyToken(token) : null;

    if (userId === null) {
        res.status(401).json({
            message: "Not logged in."
        });
        return;
    }

    req.userId = userId;
    next();
}
