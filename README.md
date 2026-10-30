# quiz

An Only Connect–style quiz runner for Exun (DPS RK Puram's tech club). It runs Standard questions, Connections, Sequences, the Connecting Wall and Missing Vowels, for 2–6 teams per match.

There are three views:

| URL        | Who                | What                                                       |
| ---------- | ------------------ | ---------------------------------------------------------- |
| `/display` | Projector          | What the audience sees. Never receives unrevealed answers. |
| `/host`    | Quizmaster's phone | Drives the game: picks, reveals, scoring, wall taps, undo. |
| `/admin`   | Quiz setters       | Teams, question bank, matches, media, JSON import/export.  |

The server keeps the only copy of the game state, persists it to SQLite on every action (so a restart resumes mid-match), and pushes a per-role view to each client over a WebSocket (`/ws`). `GET /healthz` is always open.

## Running locally

Needs Node 24 and pnpm (`corepack enable`).

```sh
pnpm install
pnpm dev                 # server on :8080 + Vite on :5173 (open http://localhost:5173/display)
```

Or the production build, everything on :8080:

```sh
pnpm build && pnpm start
```

Load the demo quiz (**demo content, to be replaced with the real questions**; importing _replaces_ all teams, questions and matches):

```sh
pnpm seed:demo                                    # URL defaults to http://localhost:8080
URL=http://localhost:8080 HOST_PIN=1234 pnpm seed:demo   # in pin mode
```

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`. `pnpm smoke <none|pin|proxy>` runs an HTTP + WebSocket smoke test against a running server (env `URL`, `HOST_PIN`, `EMAIL`).

### Configuration

| Variable         | Default      | Notes                                                                                            |
| ---------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| `PORT`           | `8080`       |                                                                                                  |
| `HOST`           | `0.0.0.0`    | `127.0.0.1` in proxy mode, so only the oauth2-proxy sidecar can reach it.                        |
| `DATA_DIR`       | `./data`     | SQLite database (`quiz.db`) and uploaded media.                                                  |
| `WEB_DIR`        | `./dist/web` | Built SPA.                                                                                       |
| `AUTH_MODE`      | `none`       | `none`, `pin` or `proxy`; see below.                                                             |
| `HOST_PIN`       |              | Required for `pin`.                                                                              |
| `SESSION_SECRET` | random       | Signs the pin-mode cookie. Set it, or the phone is logged out on every restart.                  |
| `ALLOWED_EMAILS` |              | Proxy mode: comma-separated allowlist (case-insensitive). Empty = anyone the proxy lets through. |

## Auth modes

- **`none`**: development. Everything is open.
- **`pin`**: the offline fallback. `/display` and the display WebSocket are open; `/host`, the host WebSocket and `/api/admin/*` need a signed cookie obtained by entering `HOST_PIN` (valid for 7 days).
- **`proxy`**: production. oauth2-proxy (Zitadel) sits in front and sets `X-Auth-Request-Email`; every request except `/healthz` needs it, including the display. With `ALLOWED_EMAILS` set, only those emails get in. The app binds to `127.0.0.1` so the proxy can't be bypassed.

## Docker

```sh
docker build -t simplycorrelate .
mkdir -p data
docker run --rm -p 8080:8080 -v ./data:/data \
  -e AUTH_MODE=pin -e HOST_PIN=1234 -e SESSION_SECRET=change-me simplycorrelate
```

The image runs as uid 1000 with no `node_modules` (the server is bundled into one file), and only writes to `/data`, so it works with a read-only root filesystem. On Linux, if `./data` isn't writable by uid 1000, add `--user "$(id -u):$(id -g)"`. CI pushes `ghcr.io/vidurb/simplycorrelate:main` and `:main-<shortsha>` on every push to `main`.

## Offline fallback runbook

Use this if the venue internet or Zitadel fails. **Rehearse it on Friday.**

**Before the event** (while prod works):

1. Open `/admin` on prod and **export** the quiz JSON (Import/Export). Keep a copy on the projector laptop and on a USB stick. Re-export after any late edits.
2. On the projector laptop, have either the image pulled (`docker pull ghcr.io/vidurb/simplycorrelate:main`) or a checkout with `pnpm install` done, so nothing needs the internet.

**On the day:**

1. On the projector laptop, start the app in pin mode, with either:
   - Docker:

     ```sh
     mkdir -p data
     docker run --rm -p 8080:8080 -v ./data:/data \
       -e AUTH_MODE=pin -e HOST_PIN=<pin> -e SESSION_SECRET=<long random string> \
       ghcr.io/vidurb/simplycorrelate:main
     ```
   - or Node:

     ```sh
     pnpm build
     AUTH_MODE=pin HOST_PIN=<pin> SESSION_SECRET=<long random string> pnpm start
     ```

2. Import the exported JSON: open `http://localhost:8080/admin`, log in with the PIN and import the file, or run
   `URL=http://localhost:8080 HOST_PIN=<pin> FILE=./quiz-YYYY-MM-DD.json pnpm seed:demo`.
   (This replaces all content on the laptop.)
3. Open `http://localhost:8080/display` full-screen on the projector.
4. Connect the phone to the same network: the venue LAN/Wi-Fi, or the laptop's or phone's hotspot. Find the laptop's LAN IP (macOS: `ipconfig getifaddr en0`; Linux: `hostname -I`; Windows: `ipconfig`) and open `http://<laptop-ip>:8080/host` on the phone. Enter the PIN.
5. Allow incoming connections on port 8080 if the laptop firewall asks.

Game state lives in `./data/quiz.db`, so restarting the app (or the laptop) resumes where you left off. Undo on the host remote reverts the last action.
