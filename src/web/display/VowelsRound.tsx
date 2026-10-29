import type { GameView, VowelsView } from "../../shared/view";
import { type Mark, RoundFrame, TeamName, TimerClock, teamOf } from "./chrome";

function puzzleSize(text: string): string {
  // Michroma is wide (~0.95em per glyph incl. spacing); fit within ~88u.
  const s = Math.min(7.5, 88 / Math.max(1, text.length * 1.02));
  return `calc(var(--u) * ${s.toFixed(2)})`;
}

export function VowelsRound({
  view,
  round,
  title,
  clockOffset,
}: {
  view: GameView;
  round: VowelsView;
  title: string;
  clockOffset: number;
}) {
  const marks: Record<string, Mark> = {};
  for (const t of round.wrong) marks[t] = { tone: "bad", text: "−1" };
  if (round.correctTeamId) marks[round.correctTeamId] = { tone: "ok", text: "+1" };
  const buzzed = teamOf(view, round.buzzed);

  let body: React.ReactNode;
  if (!round.started) {
    body = (
      <div className="d-vow-card">
        <h1 className="d-vow-title">{title}</h1>
        <p className="d-vow-sub">Vowels removed, spaces moved. Buzz in when you know it.</p>
      </div>
    );
  } else if (round.clueIndex < 0) {
    body = (
      <div className="d-vow-card" key={`cat-${round.categoryIndex}`}>
        <p className="d-vow-kicker">
          Category {round.categoryIndex + 1} of {round.categoryCount}
        </p>
        <h1 className="d-vow-category">{round.category}</h1>
      </div>
    );
  } else {
    body = (
      <div className="d-vow" key={`${round.categoryIndex}-${round.clueIndex}`}>
        <p className="d-vow-cat">{round.category}</p>
        <p className="d-vow-puzzle" style={{ fontSize: puzzleSize(round.puzzle ?? "") }}>
          {round.puzzle}
        </p>
        <div className={`d-vow-answer${round.revealed ? " is-shown" : ""}`}>
          {round.revealed && (
            <>
              <span className="d-vow-answer-text">{round.answer}</span>
              {round.correctTeamId && (
                <span className="d-vow-got">
                  <TeamName view={view} id={round.correctTeamId} />
                </span>
              )}
            </>
          )}
        </div>
        <div
          className={`d-buzz${buzzed ? " is-shown" : ""}`}
          style={buzzed ? ({ "--team": buzzed.color } as React.CSSProperties) : undefined}
        >
          {buzzed && <span>{buzzed.name}</span>}
        </div>
      </div>
    );
  }

  return (
    <RoundFrame
      view={view}
      title={title}
      info={
        round.started && round.clueIndex >= 0 ? (
          <span>
            Clue <b>{round.clueIndex + 1}</b>/{round.clueCount}
          </span>
        ) : null
      }
      right={
        round.ended ? (
          <span className="d-timesup">Time's up</span>
        ) : round.started ? (
          <TimerClock timer={round.timer} clockOffset={clockOffset} />
        ) : null
      }
      timer={round.started && !round.ended ? round.timer : null}
      clockOffset={clockOffset}
      active={round.buzzed}
      marks={marks}
    >
      {body}
    </RoundFrame>
  );
}
