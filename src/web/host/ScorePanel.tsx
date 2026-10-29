import { useState } from "react";
import type { Team } from "../../shared/content";
import type { GameView } from "../../shared/view";
import { type Act, Btn, haptic } from "./ui";

export function ScorePanel({ view, teams, act }: { view: GameView; teams: Team[]; act: Act }) {
  const [open, setOpen] = useState(false);
  if (!teams.length) return null;
  return (
    <section className={`h-scores${open ? " open" : ""}`}>
      <button
        type="button"
        className="h-scores-strip"
        aria-expanded={open}
        onClick={() => {
          haptic();
          setOpen((o) => !o);
        }}
      >
        {teams.map((t) => (
          <span
            key={t.id}
            className={`h-chip${view.turnTeamId === t.id ? " turn" : ""}`}
            style={{ borderColor: t.color }}
          >
            <i style={{ background: t.color }} />
            <span className="h-chip-name">{t.name}</span>
            <b>{view.scores[t.id] ?? 0}</b>
          </span>
        ))}
        <span className="h-scores-caret">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="h-scores-body">
          {teams.map((t) => {
            const turn = view.turnTeamId === t.id;
            return (
              <div key={t.id} className={`h-score-row${turn ? " turn" : ""}`}>
                <span className="h-score-name">
                  <i style={{ background: t.color }} />
                  {t.name}
                </span>
                <b className="h-score-val">{view.scores[t.id] ?? 0}</b>
                <Btn
                  tone="bad"
                  aria-label={`Minus one for ${t.name}`}
                  onClick={() => act({ type: "adjustScore", teamId: t.id, delta: -1 })}
                >
                  −1
                </Btn>
                <Btn
                  tone="ok"
                  aria-label={`Plus one for ${t.name}`}
                  onClick={() => act({ type: "adjustScore", teamId: t.id, delta: 1 })}
                >
                  +1
                </Btn>
                <Btn
                  tone={turn ? "primary" : "ghost"}
                  active={turn}
                  onClick={() => act({ type: "setTurn", teamId: t.id })}
                >
                  {turn ? "Turn ●" : "Turn"}
                </Btn>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
