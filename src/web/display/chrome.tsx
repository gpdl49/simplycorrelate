import type { ReactNode } from "react";
import type { Timer } from "../../shared/game";
import type { GameView } from "../../shared/view";
import { formatMs, useTimerRemaining } from "../lib/timer";

export interface Mark {
  tone: "ok" | "bad";
  text: string;
}

/** Slim team strip along the bottom of every round screen. */
export function ScoreBar({
  view,
  active,
  marks = {},
}: {
  view: GameView;
  active: string | null;
  marks?: Record<string, Mark>;
}) {
  return (
    <div className="d-scorebar">
      {view.teams.map((t) => {
        const mark = marks[t.id];
        const score = view.scores[t.id] ?? 0;
        return (
          <div
            key={t.id}
            className={`d-sb-team${t.id === active ? " is-active" : ""}${mark ? ` is-${mark.tone}` : ""}`}
            style={{ "--team": t.color } as React.CSSProperties}
          >
            <span className="d-sb-turn" aria-hidden />
            <span className="d-sb-chip" />
            <span className="d-sb-name">{t.name}</span>
            <span key={score} className="d-sb-score">
              {score}
            </span>
            {mark && <span className={`d-sb-mark d-mark-${mark.tone}`}>{mark.text}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Glowing bar across the top of the stage that drains as the timer runs. */
export function TimerBar({ timer, clockOffset }: { timer: Timer | null; clockOffset: number }) {
  const ms = useTimerRemaining(timer, clockOffset);
  if (!timer) return null;
  const frac = timer.durationMs > 0 ? ms / timer.durationMs : 0;
  const low = ms <= 10_000;
  const paused = timer.startedAt === null && ms > 0;
  return (
    <div className={`d-timerbar${low ? " is-low" : ""}${paused ? " is-paused" : ""}`}>
      <div className="d-timerbar-fill" style={{ transform: `scaleX(${frac})` }} />
    </div>
  );
}

export function TimerClock({ timer, clockOffset }: { timer: Timer | null; clockOffset: number }) {
  const ms = useTimerRemaining(timer, clockOffset);
  if (!timer) return null;
  const paused = timer.startedAt === null && ms > 0;
  return (
    <span className={`d-clock${ms <= 10_000 ? " is-low" : ""}${paused ? " is-paused" : ""}`}>
      {formatMs(ms)}
    </span>
  );
}

/** Header + body + score bar layout shared by every round type. */
export function RoundFrame({
  view,
  title,
  info,
  right,
  timer,
  clockOffset,
  active,
  marks,
  children,
}: {
  view: GameView;
  title: string;
  info?: ReactNode;
  right?: ReactNode;
  timer?: Timer | null;
  clockOffset: number;
  active: string | null;
  marks?: Record<string, Mark>;
  children: ReactNode;
}) {
  return (
    <div className="d-round">
      <TimerBar timer={timer ?? null} clockOffset={clockOffset} />
      <header className="d-round-head">
        <h2 className="d-round-title">{title}</h2>
        <div className="d-round-info">{info}</div>
        <div className="d-round-right">{right}</div>
      </header>
      <main className="d-round-body">{children}</main>
      <ScoreBar view={view} active={active} marks={marks} />
    </div>
  );
}

export function teamOf(view: GameView, id: string | null) {
  return id ? view.teams.find((t) => t.id === id) : undefined;
}

export function TeamName({ view, id }: { view: GameView; id: string | null }) {
  const t = teamOf(view, id);
  if (!t) return null;
  return (
    <span className="d-teamname" style={{ "--team": t.color } as React.CSSProperties}>
      {t.name}
    </span>
  );
}
