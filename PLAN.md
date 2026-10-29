# simplycorrelate — plan

A quiz runner in the style of Only Connect, built for Exun and run live on Saturday 31 Oct 2026. It has three views:

- **display** on the projector
- **host remote** on the quizmaster's phone, which drives everything, including tapping the wall
- **admin** for writing questions and configuring matches

## Teams and matches

- **Teams:** six by default, editable in admin (name and colour).
- **Matches:** set up in admin. Each match has:
  - a name
  - its participating teams (any 2–6)
  - an ordered list of rounds, each taking questions from the question bank
- **Running a match:** the host picks a match on the phone, and all scores are scoped to that match. A separate overall leaderboard sums across matches; it can be hidden.
- **Multi-team rules:** the TV show has exactly two teams, so some rules are generalised:
  - Turn order rotates through the teams in the match.
  - A **steal or bonus** goes to whichever team the host taps, since physical buzzers decide who answers.

## Rounds

| Round                    | Mechanics                                                                                                                                                                                                                                                                                           | Host remote                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Standard**             | A text question, optionally with an image. The host reveals the answer, then awards points to one or more teams. Points per question are configurable (default 1). Negative marking is optional.                                                                                                    | Show Q · Reveal A · Award: tap team(s) · Next                                                                                                               |
| **Connections**          | The team on turn picks one of the six hieroglyphs. Up to 4 clues are revealed one at a time, with a 40s timer. It scores 5/3/2/1 points by how many clues were seen. If the team is wrong, the host picks a team to steal for 1 point.                                                              | Next clue · ✓ · ✗ → pick stealing team ✓/✗ · Reveal                                                                                                         |
| **Sequences** (optional) | Uses the Connections engine. Three clues are shown and the team gives the fourth.                                                                                                                                                                                                                   | Same as Connections                                                                                                                                         |
| **Connecting Wall**      | 16 tiles making four groups of four, with a 2:30 timer. A team gets unlimited tries until two groups are found, then has 3 lives. When time or lives run out, the wall resolves. It scores 1 per group found plus 1 per connection named. Getting everything earns a 2-point bonus, for 10 maximum. | **The phone shows the 16 tiles. The host taps the four the team calls out**, and the display animates the result. Pause · Resolve · ✓/✗ for each connection |
| **Missing Vowels**       | Categories of up to four clues each, with the vowels stripped out and the spacing redistributed. Teams answer on the physical buzzers, scoring +1 for a right answer and −1 for a wrong one. Optional steal. The round is timed.                                                                    | Tap the team that buzzed · ✓ / ✗ · (steal: tap team ✓/✗) · Next · Reveal                                                                                    |

Shared features:
- Scoreboard, plus manual score adjustment.
- Undo of the last action, from the action log.
- Round intro slides, and a holding-screen toggle.
- Clue media can be text, an image, or audio.

## Admin interface

- **Teams:** add, rename, recolour.
- **Question bank,** with a form for each question type:
  - **Standard:** question, answer, points, optional image.
  - **Connection / Sequence:** four clues (each text, image, or audio), the connection, and an explanation shown to the host.
  - **Wall:** four groups, each with four clues and a connection.
    - The form warns about duplicate clues.
    - It can shuffle and preview the wall.
  - **Missing Vowels category:** the category name and up to four answers.
    - The disguised version is generated automatically. A live preview is shown, with a "reshuffle spacing" button and a per-clue manual override.
- **Matches:** pick teams, add rounds, and assign questions to rounds. Rounds can be reordered by drag or up/down arrows.
  - Within a match, Connections and Sequences have six hieroglyph slots each.
- **Media uploads** are stored on the PVC.
- **Import and export of the whole quiz as JSON.** This is the backup plan, and it also lets questions be bulk-pasted.
- **Locking:** a "lock match" action stops edits while the match is running.

## Architecture

```
 browser ── kgateway ── oauth2-proxy :4180 (Zitadel) ── app :8080 (127.0.0.1 only)
                                                          ├─ SPA: /display /host /admin
                                                          ├─ REST /api/* (admin CRUD, uploads)
                                                          ├─ WS /ws (live game)
                                                          └─ SQLite + media on /data (PVC)
```

- **Code layout:** one TypeScript repo, one container image, a pnpm workspace with `server/`, `web/` and `shared/`.
- **Server:** Node 22 with Hono, `ws`, and SQLite (better-sqlite3 + Drizzle). Schemas in `shared/` use zod.
- **Client:** Vite + React with React Router, and TanStack Query for admin.
- **Game state:**
  - The server holds the only copy of the state, updated by a pure reducer `(state, action) → state`. There are unit tests for every scoring rule.
  - Live state and the action log are persisted to SQLite on every action, so a pod restart resumes mid-match.
- **Role-specific views of state:**
  - The display never receives answers before they are revealed.
  - The host receives answers and wall groupings.
- **Timers** are server-side deadlines; clients animate locally.
- **Resilience:**
  - A 25s app-level ping (Envoy's idle timeout is 5 min).
  - Auto-reconnect with full resync.
  - A "disconnected" badge on the remote.
  - Wake lock on the phone, and big tap targets.

### Auth (Zitadel)

- **Pattern:** follows the homestacks pattern of an oauth2-proxy sidecar in front of the app (template: `clusters/sinkhole/archivebox-system/`).
  - The app listens only on 127.0.0.1, so the sidecar is the only way in.
  - The app reads `X-Auth-Request-Email` to show who is logged in.
- **Who gets in:** limited to your account, plus any helpers, via a Zitadel project role or the oauth2-proxy email allowlist.
- **What it protects:** everything, including the display. You log in once on the projector laptop and once on your phone.
  - This avoids skip-auth routes and keeps answers private.
  - The QR code on the display becomes a quick link to `/host`. Pairing is just "log in on the phone".
- **Offline fallback:** with `AUTH_MODE=none` or `AUTH_MODE=pin`, the same image runs on the projector laptop without Zitadel if the venue internet fails. The phone joins over the LAN or a hotspot, and the quiz data comes from the JSON export. Rehearse this on Friday.

## Branding (Exun)

Colours are taken from exunclan.com's CSS and logo:

| Token          | Hex       | Use                            |
| -------------- | --------- | ------------------------------ |
| `--exun-blue`  | `#2977F5` | Primary, wall tiles, timer bar |
| `--exun-ink`   | `#1B2A33` | Backgrounds                    |
| `--exun-navy`  | `#194A6D` | Secondary surfaces             |
| `--exun-slate` | `#435A7E` | Muted text, borders            |
| `--exun-sky`   | `#D0E2FF` | Highlights                     |
| `--exun-mist`  | `#F4F8FF` | Light text and surfaces        |
- **Fonts:** Inter for body text. For headings, an open-licence wide display face close to the logo (Michroma or Krona One).
- **Colours beyond the brand palette:**
  - The four found-wall-group colours need to be distinct from each other.
  - The six team colours need to be tuned to stay legible on a projector.
- **Logo:** `exunclan.com/logo.png`.
- **Layout:** design for the projector first: 16:9, high contrast, large type.

## Hosting (homestacks → Sinkhole)

See @thread:thr_6wahercx5z for the full report.

- **Cluster:** Sinkhole (Hetzner, amd64), at `simplycorrelate.vidur.xyz` (or `quiz.vidur.xyz`).
- **Manifests:** Flux plus Kustomize under `clusters/sinkhole/simplycorrelate-system/`:
  - Deployment layout copied from freshrss.
  - oauth2-proxy sidecar, a Crossplane Zitadel OIDC app, an ExternalSecret, and a SOPS cookie secret, all copied from archivebox.
- **Image:** built in this repo's GitHub Actions and pushed to `ghcr.io/vidurb/simplycorrelate:main` (linux/amd64). Flux image automation rolls it out.
- **Edge:**
  - A new kgateway HTTPS listener and a cert-manager `Certificate`. external-dns creates the DNS record.
  - The HTTPRoute must set `timeouts.request: 0s`, or WebSockets die after 15s.
- **Pod:**
  - 1 replica with `Recreate`, and a 1Gi `openebs-zfs` PVC at `/data`.
  - Non-root with a read-only root filesystem, plus an `emptyDir` at `/tmp`.
  - Probes and resources set, to satisfy kube-linter.

## Build order

1. **Scaffold** (Thu): workspace, Biome, Vitest, Dockerfile, GHCR CI. Push to `github.com/vidurb/simplycorrelate`.
2. **Core** (Thu): DB schema and zod types, the game reducer with tests, WS hub, persistence, auth middleware (proxy headers, or the none/pin modes).
3. **Admin** (Thu night/Fri AM): teams, question bank forms, match builder, uploads, import and export. This lets you write questions while the rest is built.
4. **Live views** (Fri):
   - Standard and Connections/Sequences
   - Wall, with a phone tap grid
   - Missing Vowels
   - Scoreboard and round transitions
5. **Branding pass** on a projector-sized window.
6. **Deploy** (Fri AM, in parallel with step 4):
   - Push the homestacks changes and the Zitadel app early. DNS-01 and external-dns take minutes.
   - Test from mobile data.
7. **Rehearsal** (Fri PM): load the real questions, do a full dry run, and test the offline fallback.
