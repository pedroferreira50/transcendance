## Open Sea

A browser multiplayer game: fish compete for diamonds and try to reach the turtle at the far end of the reef.

## Technologies used

**Frontend** (`frontend/`)
- **React 19** + **TypeScript** — UI, written as function components with hooks.
- **Vite** — dev server, build tool, and proxy to the backend.
- **socket.io-client** — real-time lobbies and live matches.
- **i18next / react-i18next** — English, Portuguese, and French.
- **Canvas** — the game board, sprites, and touch controls.

**Backend** (`backend/`)
- **Express 5** — REST API for registration, login, session lookup, and logout.
- **Socket.IO** — lobby browsing, ready-up, match start, live game state, spectators, and reconnect/resume.
- **better-sqlite3** — SQLite user accounts and win/loss statistics.
- **argon2** — password hashing.
- **jsonwebtoken** + httpOnly cookie — sessions.
- **tsx** — runs the TypeScript backend directly in dev (`tsx watch`).

**Infrastructure**
- **Docker + Compose** — `docker-compose.yml` for development, `docker-compose.test.yml` for the nginx HTTPS deployment.
- **nginx** — serves the built frontend, proxies `/api` and `/socket.io`, and generates a self-signed certificate on first start.

## Running it

### Development

```
cp backend/.env.example backend/.env    # then set JWT_SECRET
docker compose up --build
```

Frontend: http://localhost:5173 — Backend: http://localhost:3000

The frontend calls relative `/api/*` paths; Vite forwards them to the backend. Socket.IO uses `/socket.io`.

### HTTPS / production-style build

```
cp .env.example .env    # then set JWT_SECRET
docker compose -f docker-compose.test.yml up --build
```

Open https://localhost:8443 (the self-signed certificate triggers a browser warning). HTTP on http://localhost:8080 redirects to https://localhost:8443.

`FRONTEND_ORIGIN` must match the browser origin, including the published port. `DATABASE_URL` and the `backend-data` volume keep the SQLite database across container recreations.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/register` | Create an account. |
| `POST` | `/api/login` | Log in and set the session cookie. |
| `GET` | `/api/me` | Current user and statistics. |
| `POST` | `/api/logout` | Clear the session cookie. |

Login and registration are rate-limited per IP. The session cookie is `httpOnly`; `COOKIE_SECURE=true` is required when served over HTTPS.

## Project structure

### Root

| File | Purpose |
|---|---|
| `docker-compose.yml` | Development services: Vite frontend and backend with bind mounts. |
| `docker-compose.test.yml` | nginx HTTPS deployment with a persistent SQLite volume. |
| `nginx/` | nginx config, frontend production build, and self-signed certificate generation. |

### `backend/`

| File | Purpose |
|---|---|
| `src/server.ts` | Express + Socket.IO entry point; mounts auth routes under `/api`. |
| `src/auth.ts` | JWT signing/verification, cookie helpers, and `requireAuth`. |
| `src/authRoutes.ts` | Register, login, me, and logout routes with rate limiting. |
| `src/database.ts` | Opens SQLite from `DATABASE_URL` (or `users.db`) and migrates the users table. |
| `src/databasePath.ts` | Converts plain paths and `file:` URLs into a SQLite path. |
| `src/rateLimit.ts` | In-memory fixed-window limiter for the auth endpoints. |
| `src/lobby.ts` | Lobby list, create/join/ready/kick/settings, match start/end, persistence of results. |
| `src/socketAuth.ts` | Socket authentication and one-connection-per-user. |
| `src/game/GameManager.ts` | Creates matches, countdown, per-second tick, broadcasts, spectators, reconnect. |
| `src/game/GameRoom.ts` | Game rules: movement, diamonds, sharks, power-ups, respawns, win conditions. |
| `src/game/gameSocket.ts` | Validates and routes player input, local matches, spectating, and reconnects. |
| `src/game/mapLoader.ts`, `placement.ts` | `.ber` map loading/validation and random placement. |
| `maps/` | Maps for 2, 3, and 4 players. |
| `src/**/__tests__/` | Vitest suites. Requires Node 22 (the project's Docker images). |

### `frontend/`

| File | Purpose |
|---|---|
| `src/App.tsx` | Session bootstrap/logout and legal-page routing. |
| `src/OpenSea` screens (`src/components/`) | Intro, menu, instructions, login/register, profile, lobby list, lobby room, local setup, match, spectator view, and winner screen. |
| `src/game/` | Protocol types, map metadata, keyboard/touch input, renderer, and sprites. |
| `src/i18n/` | `en.json`, `pt.json`, `fr.json`, and i18next setup. |
| `src/api.ts` | `fetch` wrapper for `/api/*`. |
| `src/socket.ts` | Shared Socket.IO client (`autoConnect: false`). |
| `src/types/` | Session and registration form types. |

## Real-time flow

A lobby is a `Map` entry keyed by a short code, which is also the Socket.IO room name. Browsers subscribe to the `lobby-list` room for live summaries. Inside a lobby, players choose fish and ready up; the host chooses seats/map and starts the match. `GameManager` snapshots the roster, sends a countdown, then runs a server-authoritative game loop: `/api` handles accounts, while Socket.IO sends `game:state` (at most once per second while running, plus after changes), `game:event` for hits and pickups, and `game:end` with the final result. Scores are written to SQLite when an online match ends. Disconnected players can reconnect and resume; spectators receive the same game events without a seat. Local matches run in the browser without affecting statistics.
