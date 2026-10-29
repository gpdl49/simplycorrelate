import { type ReactNode, useEffect, useState } from "react";
import type { Team } from "../../shared/content";
import type { Action, Screen } from "../../shared/game";
import type { GameView, RoundView } from "../../shared/view";
import { formatMs, useTimerRemaining } from "../lib/timer";
import { useGame } from "../lib/useGame";
import { Login } from "./Login";
import { MatchSheet } from "./MatchSheet";
import { BoardPanel } from "./rounds/BoardPanel";
import { ConnectionPanel } from "./rounds/ConnectionPanel";
import { StandardPanel } from "./rounds/StandardPanel";
import { VowelsPanel } from "./rounds/VowelsPanel";
import { WallPanel } from "./rounds/WallPanel";
import { ScorePanel } from "./ScorePanel";
import { type Act, Btn, Card, haptic } from "./ui";
import { useWakeLock } from "./useWakeLock";
import "./host.css";

const SCREENS: { id: Screen; label: string }[] = [
  { id: "holding", label: "Holding" },
  { id: "scoreboard", label: "Scores" },
  { id: "round", label: "Round" },
  { id: "leaderboard", label: "Leaders" },
];
const SCREEN_LABEL: Record<Screen, string> = {
  holding: "Holding",
  scoreboard: "Scoreboard",
  round: "Round",
  leaderboard: "Leaderboard",
};

export function HostApp() {
  const { view, connected, error, unauthorised, clockOffset, dispatch, undo } = useGame("host");
  const wake = useWakeLock();
  const [sheet, setSheet] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Host · simplycorrelate";
  }, []);
  // A new error un-dismisses the toast; errors auto-hide after 6s.
  useEffect(() => {
    if (!error) {
      setDismissed(null);
      return;
    }
    const id = window.setTimeout(() => setDismissed(error), 6000);
    return () => window.clearTimeout(id);
  }, [error]);

  if (unauthorised) return <Login />;

  const act: Act = (a: Action) => dispatch(a);
  const showError = error && error !== dismissed && error !== "unauthorised";

  return (
    <div className="host">
      <TopBar view={view} connected={connected} wake={wake} clockOffset={clockOffset} act={act} />
      {showError && (
        <button type="button" className="h-toast" onClick={() => setDismissed(error)}>
          <b>⚠ {error}</b>
          <small>tap to dismiss</small>
        </button>
      )}
      {view && !connected && (
        <div className="h-offline">
          Reconnecting… taps won't reach the projector until this clears.
        </div>
      )}
      <main className="h-main">
        {!view ? (
          <p className="h-center h-muted">Connecting to the quiz server…</p>
        ) : (
          <Body view={view} act={act} openMatch={() => setSheet(true)} />
        )}
      </main>
      <nav className="h-dock">
        <fieldset className="h-screens" aria-label="Projector screen">
          {SCREENS.map((s) => (
            <Btn
              key={s.id}
              active={view?.screen === s.id}
              aria-pressed={view?.screen === s.id}
              tone={view?.screen === s.id ? "primary" : "ghost"}
              disabled={!view}
              onClick={() => act({ type: "setScreen", screen: s.id })}
            >
              {s.label}
            </Btn>
          ))}
        </fieldset>
        <div className="h-dock-row">
          <Btn tone="warn" className="h-undo" disabled={!view} onClick={undo}>
            ↶ Undo last
          </Btn>
          <Btn tone="neutral" disabled={!view} onClick={() => setSheet(true)}>
            ☰ Match
          </Btn>
        </div>
      </nav>
      {sheet && view && <MatchSheet view={view} act={act} onClose={() => setSheet(false)} />}
    </div>
  );
}

function roundTimer(r: RoundView | null) {
  if (!r || r.type === "standard") return null;
  return r.timer;
}

function timerLive(r: RoundView | null): boolean {
  if (!r) return false;
  if (r.type === "connection" || r.type === "sequence" || r.type === "wall")
    return r.phase === "play";
  if (r.type === "vowels") return r.started && !r.ended;
  if (r.type === "board") return r.phase === "play";
  return false;
}

function TopBar({
  view,
  connected,
  wake,
  clockOffset,
  act,
}: {
  view: GameView | null;
  connected: boolean;
  wake: boolean;
  clockOffset: number;
  act: Act;
}) {
  const timer = roundTimer(view?.round ?? null);
  const ms = useTimerRemaining(timer, clockOffset);
  const running = !!timer && timer.startedAt !== null;
  const canControl = !!timer && timerLive(view?.round ?? null) && ms > 0;
  const round = view?.match && view.roundIndex !== null ? view.match.rounds[view.roundIndex] : null;

  return (
    <header className="h-top">
      <div className="h-top-row">
        <span className={`h-pill ${connected ? "on" : "off"}`}>
          <i />
          {connected ? "Live" : "Offline"}
        </span>
        <span className="h-top-match">{view?.match?.name ?? "No match"}</span>
        <span className="h-pill screen" title="Projector screen">
          📺 {view ? SCREEN_LABEL[view.screen] : "—"}
        </span>
        {!wake && (
          <span className="h-pill warn" title="Screen may sleep">
            💤
          </span>
        )}
      </div>
      <div className="h-top-row">
        <span className="h-top-round">
          {round ? `R${(view?.roundIndex ?? 0) + 1} · ${round.title}` : "No round"}
        </span>
        {timer && (
          <button
            type="button"
            className={`h-timer${running ? " running" : ""}${ms < 10_000 && running ? " low" : ""}`}
            disabled={!canControl}
            onClick={() => {
              haptic();
              act({ type: running ? "pauseTimer" : "resumeTimer" });
            }}
            aria-label={running ? "Pause timer" : "Resume timer"}
          >
            <span className="h-timer-val">{formatMs(ms)}</span>
            {canControl && <span className="h-timer-act">{running ? "❚❚ Pause" : "▶ Resume"}</span>}
          </button>
        )}
      </div>
    </header>
  );
}

function Body({ view, act, openMatch }: { view: GameView; act: Act; openMatch: () => void }) {
  const teams: Team[] = view.match ? view.teams.filter((t) => t.id in view.scores) : [];
  const turnTeam = teams.find((t) => t.id === view.turnTeamId);
  const r = view.round;

  let panel: ReactNode;
  if (!view.match) {
    panel = (
      <Card title="No match running">
        <p className="h-muted">Pick a match to start.</p>
        <Btn big tone="primary" onClick={openMatch}>
          Choose match…
        </Btn>
      </Card>
    );
  } else if (!r) {
    panel = (
      <Card title={view.match.name}>
        <p className="h-muted">No round in progress. Pick one to begin.</p>
        <Btn big tone="primary" onClick={openMatch}>
          Choose round…
        </Btn>
      </Card>
    );
  } else {
    const key = `${view.roundIndex}-${"phase" in r ? r.phase : ""}`;
    switch (r.type) {
      case "standard":
        panel = <StandardPanel key={key} r={r} teams={teams} act={act} />;
        break;
      case "connection":
      case "sequence":
        panel = <ConnectionPanel key={key} r={r} teams={teams} turnTeam={turnTeam} act={act} />;
        break;
      case "wall":
        panel = (
          <WallPanel key={view.roundIndex} r={r} teams={teams} turnTeam={turnTeam} act={act} />
        );
        break;
      case "vowels":
        panel = <VowelsPanel key={key} r={r} teams={teams} act={act} />;
        break;
      case "board":
        panel = <BoardPanel key={key} r={r} teams={teams} turnTeam={turnTeam} act={act} />;
        break;
    }
  }

  return (
    <>
      <ScorePanel view={view} teams={teams} act={act} />
      {r && view.screen !== "round" && (
        <button
          type="button"
          className="h-notice"
          onClick={() => {
            haptic();
            act({ type: "setScreen", screen: "round" });
          }}
        >
          Projector is on {SCREEN_LABEL[view.screen]} — tap to show the round
        </button>
      )}
      <div className="h-panel">{panel}</div>
    </>
  );
}
