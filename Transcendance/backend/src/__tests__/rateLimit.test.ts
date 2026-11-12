import { expect, test, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { createRateLimiter } from "../rateLimit";

function fakeRequest(ip: string): Request {
	return { ip } as Request;
}

function fakeResponse() {
	const res = {
		statusCode: 200,
		headers: {} as Record<string, string>,
		body: null as unknown,
		setHeader(name: string, value: string) {
			res.headers[name] = value;
			return res;
		},
		status(code: number) {
			res.statusCode = code;
			return res;
		},
		json(body: unknown) {
			res.body = body;
			return res;
		}
	};

	return res as unknown as Response & typeof res;
}

test("allows up to the limit and then answers 429 with Retry-After", () => {
	const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
	const req = fakeRequest("1.2.3.4");

	for (let i = 0; i < 2; i++) {
		const next = vi.fn() as unknown as NextFunction;
		limiter(req, fakeResponse(), next);
		expect(next).toHaveBeenCalledOnce();
	}

	const res = fakeResponse();
	const next = vi.fn() as unknown as NextFunction;
	limiter(req, res, next);
	expect(next).not.toHaveBeenCalled();
	expect(res.statusCode).toBe(429);
	expect(res.headers["Retry-After"]).toBeDefined();
});

test("each IP has its own window", () => {
	const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
	const next = vi.fn() as unknown as NextFunction;

	limiter(fakeRequest("1.2.3.4"), fakeResponse(), next);
	limiter(fakeRequest("5.6.7.8"), fakeResponse(), next);

	expect(next).toHaveBeenCalledTimes(2);
});
