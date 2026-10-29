import type { GameView } from "../../shared/view";

export function Holding({ view, fullscreen }: { view: GameView | null; fullscreen: boolean }) {
  return (
    <div className="d-holding">
      <div className="d-holding-glow" aria-hidden />
      <img className="d-holding-logo" src="/exun-logo.png" alt="Exun" />
      <h1 className="d-holding-title">Exun Quiz</h1>
      {view?.match && <p className="d-holding-match">{view.match.name}</p>}
      {!fullscreen && <p className="d-hint">Click anywhere for fullscreen</p>}
    </div>
  );
}

export function Scoreboard({ view }: { view: GameView }) {
  const max = Math.max(1, ...view.teams.map((t) => view.scores[t.id] ?? 0));
  return (
    <div className="d-board">
      <h1 className="d-board-title">{view.match?.name ?? "Scores"}</h1>
      <div className="d-board-list">
        {view.teams.map((t) => {
          const score = view.scores[t.id] ?? 0;
          const turn = t.id === view.turnTeamId;
          return (
            <div
              key={t.id}
              className={`d-board-row${turn ? " is-turn" : ""}`}
              style={{ "--team": t.color } as React.CSSProperties}
            >
              <span className="d-board-chip" />
              <span className="d-board-name">
                {t.name}
                {turn && <span className="d-board-turn">to play</span>}
              </span>
              <span className="d-board-bar">
                <span style={{ transform: `scaleX(${Math.max(0, score) / max})` }} />
              </span>
              <span key={score} className="d-board-score">
                {score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Leaderboard({ view }: { view: GameView }) {
  const rows = view.leaderboard
    .map((r) => ({ ...r, team: view.teams.find((t) => t.id === r.teamId) }))
    .filter((r) => r.team);
  let rank = 0;
  let last: number | null = null;
  return (
    <div className="d-board">
      <h1 className="d-board-title">Leaderboard</h1>
      <div className="d-board-list">
        {rows.map((r, i) => {
          if (r.total !== last) rank = i + 1;
          last = r.total;
          return (
            <div
              key={r.teamId}
              className={`d-board-row${rank === 1 ? " is-turn" : ""}`}
              style={{ "--team": r.team!.color } as React.CSSProperties}
            >
              <span className="d-board-rank">{rank}</span>
              <span className="d-board-chip" />
              <span className="d-board-name">{r.team!.name}</span>
              <span className="d-board-score">{r.total}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RoundSplash({ view, index }: { view: GameView; index: number }) {
  const round = view.match?.rounds[index];
  if (!round) return null;
  return (
    <div className="d-splash">
      <p className="d-splash-kicker">Round {index + 1}</p>
      <h1 className="d-splash-title">{round.title}</h1>
      <div className="d-splash-rule" />
    </div>
  );
}

export function Message({ title, body }: { title: string; body?: string }) {
  return (
    <div className="d-message">
      <img className="d-message-logo" src="/exun-logo.png" alt="Exun" />
      <h1>{title}</h1>
      {body && <p>{body}</p>}
    </div>
  );
}
