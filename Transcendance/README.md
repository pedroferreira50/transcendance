## Technologies used

**Frontend** (`frontend/`)
- **React 19** + **TypeScript** — UI, written as function components with hooks (`useState`, `useEffect`).
- **Vite** — dev server and build tool.
- **socket.io-client** — real-time connection to the backend for lobbies and live multiplayer matches.
- Plain inline CSS (no UI framework) — each page/component styles itself with a `style={{ ... }}` object.

**Backend** (`backend/`)
- **Express** — REST API for registration, login, and recording solo-game results.
- **Socket.IO** — real-time layer for the lobby system and multiplayer matches (lobby browsing, ready-up, live click counts, match results).
- **better-sqlite3** — the database driver; stores users and their stats in a local SQLite file (`users.db`).
- **argon2** — password hashing.
- **tsx** — runs the TypeScript backend directly in dev (`tsx watch`), restarting on file changes.

**Infrastructure**
- **Docker** + **docker-compose** — `docker-compose.yml` runs the frontend (port 5173) and backend (port 3000) as two containers, each with the source folder bind-mounted in so edits hot-reload without rebuilding the image.

## Running it

```
docker compose up --build
```

Frontend: http://localhost:5173 — Backend: http://localhost:3000

## Project structure

### Root

| File | Purpose |
|---|---|
| `docker-compose.yml` | Defines the `frontend` and `backend` services, their ports, and bind mounts. |

> Note: `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, and `index.html` also exist directly at the repo root. These are leftovers from before the project was split into `frontend/`/`backend/` folders and aren't used by anything — the real, active copies of these files live inside `frontend/`.

### `backend/`

| File | Purpose |
|---|---|
| `Dockerfile` | Builds the backend image (`node:22`), installs build tools needed by native modules (`argon2`, `better-sqlite3`), runs `npm run dev`. |
| `package.json` | Backend dependencies and scripts (`dev`, `build`, `start`). |
| `tsconfig.json` | TypeScript compiler config. |
| `users.db` | The actual SQLite database file — created/migrated automatically by `database.ts` on startup. |
| `src/server.ts` | Express app entry point. Defines the REST endpoints (`POST /register`, `POST /login`, `POST /game-result`), wraps Express in a plain `http.Server`, and attaches the Socket.IO server to it before calling `setupLobby`. |
| `src/database.ts` | Opens the SQLite connection and creates the `users` table (`username`, `password_hash`, `wins`, `losses`, `multiplayer_wins`, `multiplayer_losses`), migrating in any missing columns on an existing database. |
| `src/lobby.ts` | All Socket.IO real-time logic: the browsable lobby list, creating/joining/readying/starting/kicking within a lobby, and the multiplayer match itself (per-second countdown, click tracking, winner detection, persisting the result to the database). See the comments above each function in that file for details. |

### `frontend/`

| File | Purpose |
|---|---|
| `Dockerfile` | Builds the frontend image (`node:22-alpine`), runs the Vite dev server bound to all interfaces so Docker can expose it. |
| `package.json` | Frontend dependencies and scripts (`dev`, `build`, `lint`, `preview`). |
| `vite.config.ts` | Vite configuration (just the React plugin). |
| `index.html` | The single HTML page Vite serves; loads `src/main.tsx`. |
| `public/favicon.svg`, `public/icons.svg` | Static assets served as-is (not processed by Vite's bundler). |
| `src/main.tsx` | React entry point — mounts `<App />` into the page's `#root` element. |
| `src/App.tsx` | Top-level page router. Holds the shared session state (logged-in username, solo/multiplayer win-loss counts, the current match) in `useState`, and renders whichever screen `page` is currently set to. |
| `src/index.css` | Global styles — CSS variables, `body`/`#root` resets, heading styles. |
| `src/App.css` | Leftover from the original Vite template; no longer imported anywhere. |
| `src/socket.ts` | Exports a single shared `socket.io-client` instance (created once, `autoConnect: false`) so every multiplayer screen talks to the same connection instead of opening a new one each. |
| `src/types/User.ts` | The `User` type (`{ username, password }`) used when submitting the registration form. |
| `src/assets/` | Background images/GIFs used by each page (login, dashboard, lobby, game, profile) plus the poker table image and a few leftover/unused template assets (`react.svg`, `vite.svg`, `hero.png`). |
| `src/components/Login.tsx` | Login form. Posts to `/login`; on success, passes the username and both solo/multiplayer stat pairs up to `App`. |
| `src/components/Register.tsx` | Registration form with client-side validation (matching passwords, non-empty fields); posts to `/register`. |
| `src/components/Dashboard.tsx` | Post-login home screen: "Play Solo" / "Play Multiplayer" / "Logout" buttons, plus the slide-out Profile panel toggle. |
| `src/components/Profile.tsx` | Displays the username and separate solo/multiplayer win-loss-percentage stat blocks; rendered inside Dashboard's slide-out panel. |
| `src/components/Game.tsx` | The solo game: a 10-second countdown, a click counter, and a fixed target (20) — reports the result to `/game-result` when time runs out. |
| `src/components/LobbySelect.tsx` | Multiplayer entry screen: shows the live list of open lobbies to join, or a button to create a new one. |
| `src/components/Lobby.tsx` | Inside one lobby: the player list (with host label and ready status), your own ready toggle, and — if you're the host — Kick buttons and the Start Match button. |
| `src/components/MultiplayerGame.tsx` | The live multiplayer match: renders each seated player as a circular avatar positioned around the poker table background, with only your own seat's button clickable, driven entirely by events from the shared `socket`. |

## Real-time flow (backend `lobby.ts` in one paragraph)

A lobby is a `Map` entry keyed by a short generated code, which also doubles as a Socket.IO room name. Players browsing for a game join a `lobby-list` room and get pushed live updates of open lobbies; joining a specific lobby moves them into that lobby's room instead. The host can kick players or start the match once everyone's readied up; starting a match snapshots the current lobby roster into a `Match`, runs a server-side countdown, and tallies clicks per player until time runs out (or everyone but one player disconnects), at which point the winner's/losers' stats are written to the database and each player receives their own updated totals.
