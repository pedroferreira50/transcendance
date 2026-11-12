import type { NextFunction, Request, Response } from "express";

type Bucket = {
    count: number;
    resetAt: number;
};

type RateLimitOptions = {
    windowMs: number;
    max: number;
    message?: string;
};

// Fixed-window, in-memory limiter: enough for this single-process backend
// and it avoids adding a dependency just to protect the auth endpoints.
export function createRateLimiter({ windowMs, max, message }: RateLimitOptions) {
    const buckets = new Map<string, Bucket>();
    let lastPrune = 0;

    return function rateLimit(req: Request, res: Response, next: NextFunction) {
        const now = Date.now();

        // drop the expired IPs from time to time so the map cannot grow forever
        if (now - lastPrune >= windowMs) {
            for (const [ip, bucket] of buckets)
                if (bucket.resetAt <= now)
                    buckets.delete(ip);
            lastPrune = now;
        }

        const key = req.ip ?? "unknown";
        let bucket = buckets.get(key);

        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + windowMs };
            buckets.set(key, bucket);
        }

        bucket.count++;

        if (bucket.count > max) {
            res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
            res.status(429).json({
                message: message ?? "Too many attempts. Try again later."
            });
            return;
        }

        next();
    };
}
