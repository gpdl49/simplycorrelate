# simplycorrelate

Only Connect–style quiz runner for Exun (DPS RK Puram's tech club). Read PLAN.md for product scope.

- One package. `src/shared` holds the zod content schema (`content.ts`), game state and actions (`game.ts`), the pure reducer (`engine.ts`), role-based projections sent to clients (`view.ts`), and the Missing Vowels disguise (`vowels.ts`).
- `src/server` is Hono + ws + node:sqlite. The hub holds the only copy of the game state; clients send actions, and the server broadcasts a `GameView` per role. Admin REST lives under `/api/admin/*`.
- `src/web` is Vite + React 19 + react-router 8 (library mode) + TanStack Query. The routes are `/display` (projector), `/host` (phone remote) and `/admin`. The `useGame(role)` hook is in `src/web/lib/useGame.ts`, and the timer helpers are in `lib/timer.ts`.
- Branding: use the CSS variables in `src/web/theme.css` (Exun blue `#2977F5`, ink `#1B2A33`). Use Michroma for display type and Inter for body text. Use plain CSS (per-component `.css` files or CSS modules); don't add Tailwind.
- Commands:
  - `pnpm dev` runs the server on :8080 and Vite on :5173 with a proxy.
  - `pnpm build && pnpm start` serves everything on :8080.
  - `pnpm test`, `pnpm typecheck` and `pnpm lint` are the checks.
- Run the server with `node --import tsx`. `tsx watch` fails in the sandbox.
- Auth modes: `AUTH_MODE=none` (dev), `pin` (offline fallback, `HOST_PIN`), `proxy` (oauth2-proxy + Zitadel in prod).
