import type { GameView, StandardView } from "../../shared/view";
import { type Mark, RoundFrame } from "./chrome";
import { MediaView } from "./Media";

function promptSize(text: string, hasMedia: boolean): string {
  const n = text.length;
  const base = n < 60 ? 4.4 : n < 120 ? 3.6 : n < 220 ? 2.9 : 2.4;
  return `calc(var(--u) * ${hasMedia ? base * 0.82 : base})`;
}

export function StandardRound({
  view,
  round,
  title,
  clockOffset,
}: {
  view: GameView;
  round: StandardView;
  title: string;
  clockOffset: number;
}) {
  const marks: Record<string, Mark> = {};
  for (const t of round.awarded) marks[t] = { tone: "ok", text: `+${round.points}` };
  for (const t of round.penalised) marks[t] = { tone: "bad", text: `−${round.penalty}` };
  return (
    <RoundFrame
      view={view}
      title={title}
      info={
        <span>
          Question <b>{round.index + 1}</b>/{round.total}
        </span>
      }
      right={
        round.points !== 1 || round.penalty ? (
          <span className="d-pill">
            {round.points} pt{round.points === 1 ? "" : "s"}
            {round.penalty ? ` · −${round.penalty}` : ""}
          </span>
        ) : null
      }
      clockOffset={clockOffset}
      active={view.turnTeamId}
      marks={marks}
    >
      <div className="d-std" key={round.index}>
        <p className="d-std-prompt" style={{ fontSize: promptSize(round.prompt, !!round.media) }}>
          {round.prompt}
        </p>
        {round.media && (
          <div className="d-std-media">
            <MediaView media={round.media} />
          </div>
        )}
        <div className={`d-std-answer${round.revealed ? " is-shown" : ""}`}>
          {round.revealed && round.answer !== undefined && (
            <>
              <span className="d-std-answer-label">Answer</span>
              <span className="d-std-answer-text">{round.answer}</span>
            </>
          )}
        </div>
      </div>
    </RoundFrame>
  );
}
