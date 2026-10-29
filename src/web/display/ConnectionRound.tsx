import { useRef } from "react";
import type { Clue } from "../../shared/content";
import type { ConnectionView, GameView, SlotView } from "../../shared/view";
import { type Mark, RoundFrame, TeamName, TimerClock } from "./chrome";
import { MediaView } from "./Media";

export function GlyphGrid({
  view,
  slots,
  teamId,
  prompt,
}: {
  view: GameView;
  slots: SlotView[];
  teamId: string | null;
  prompt: string;
}) {
  return (
    <div className="d-pick">
      <p className="d-pick-prompt">
        <TeamName view={view} id={teamId} />
        {teamId ? ", " : ""}
        {prompt}
      </p>
      <div className={`d-glyphs d-glyphs-${slots.length}`}>
        {slots.map((s) => (
          <div key={s.slot} className={`d-glyph${s.available ? "" : " is-used"}`}>
            <span className="d-glyph-symbol">{s.glyph.symbol}</span>
            <span className="d-glyph-name">{s.glyph.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function clueSize(text: string): string {
  const n = text.length;
  const s = n < 14 ? 3 : n < 30 ? 2.5 : n < 60 ? 2 : 1.6;
  return `calc(var(--u) * ${s})`;
}

function ClueCard({
  clue,
  index,
  shown,
  mystery,
  points,
  answer = false,
}: {
  answer?: boolean;
  clue: Clue | undefined;
  index: number;
  shown: boolean;
  mystery: boolean;
  points: number | null;
}) {
  return (
    <div className="d-clue-slot">
      <div className={`d-clue-points${points !== null ? " is-shown" : ""}`}>
        {points !== null && (
          <>
            <b>{points}</b> point{points === 1 ? "" : "s"}
          </>
        )}
      </div>
      <div
        className={`d-clue${shown ? " is-shown" : ""}${mystery ? " is-mystery" : ""}${
          points !== null ? " is-current" : ""
        }${answer ? " is-answer" : ""}`}
      >
        {mystery ? (
          <span className="d-clue-mystery">?</span>
        ) : shown && clue ? (
          <>
            {clue.media && <MediaView media={clue.media} className="d-clue-media" />}
            {clue.text && (
              <span className="d-clue-text" style={{ fontSize: clueSize(clue.text) }}>
                {clue.text}
              </span>
            )}
          </>
        ) : (
          <span className="d-clue-num">{index + 1}</span>
        )}
      </div>
    </div>
  );
}

export function ConnectionRound({
  view,
  round,
  title,
  clockOffset,
}: {
  view: GameView;
  round: ConnectionView;
  title: string;
  clockOffset: number;
}) {
  const sequence = round.type === "sequence";
  // The view forgets the points once the question is done (shown becomes 4), so remember them.
  const won = useRef<number | null>(null);
  if (round.phase === "play") won.current = round.pointsNow;
  if (round.phase === "pick") won.current = null;

  const marks: Record<string, Mark> = {};
  let active: string | null = view.turnTeamId;
  if (round.phase !== "pick") active = round.teamId;
  if (round.phase === "steal") {
    if (round.teamId) marks[round.teamId] = { tone: "bad", text: "✗" };
    active = round.stealTeamId;
  }
  if (round.phase === "done") {
    active = null;
    if (round.outcome === "correct" && round.teamId)
      marks[round.teamId] = { tone: "ok", text: won.current ? `+${won.current}` : "✓" };
    if (round.outcome === "stolen" && round.stealTeamId) {
      marks[round.stealTeamId] = { tone: "ok", text: "+1" };
      if (round.teamId) marks[round.teamId] = { tone: "bad", text: "✗" };
    }
    if (round.outcome === "missed" && round.teamId)
      marks[round.teamId] = { tone: "bad", text: "✗" };
  }

  const inPlay = round.phase !== "pick";
  const glyph = round.slots.find((s) => !s.available && inPlay);

  return (
    <RoundFrame
      view={view}
      title={title}
      info={
        inPlay ? (
          <span>
            <TeamName view={view} id={round.teamId} />
          </span>
        ) : null
      }
      right={
        round.phase === "play" ? <TimerClock timer={round.timer} clockOffset={clockOffset} /> : null
      }
      timer={round.phase === "play" ? round.timer : null}
      clockOffset={clockOffset}
      active={active}
      marks={marks}
    >
      {round.phase === "pick" ? (
        <GlyphGrid
          view={view}
          slots={round.slots}
          teamId={view.turnTeamId}
          prompt="choose a hieroglyph"
        />
      ) : (
        <div className="d-conn">
          <div className="d-clues">
            {[0, 1, 2, 3].map((i) => {
              const shown = i < round.clues.length;
              const mystery = sequence && i === 3 && round.phase !== "done";
              const current = round.phase === "play" && i === round.shown - 1;
              return (
                <ClueCard
                  key={i}
                  index={i}
                  clue={round.clues[i]}
                  shown={shown}
                  mystery={mystery}
                  points={current ? round.pointsNow : null}
                  answer={sequence && i === 3 && round.phase === "done"}
                />
              );
            })}
          </div>
          <ConnectionFooter view={view} round={round} />
          {glyph && round.phase === "play" && (
            <span className="d-conn-glyph">{glyph.glyph.symbol}</span>
          )}
        </div>
      )}
    </RoundFrame>
  );
}

function ConnectionFooter({ view, round }: { view: GameView; round: ConnectionView }) {
  if (round.phase === "steal") {
    return (
      <div className="d-conn-foot d-conn-steal">
        {round.stealTeamId ? (
          <>
            Over to <TeamName view={view} id={round.stealTeamId} />
          </>
        ) : (
          "Over to the other teams"
        )}
      </div>
    );
  }
  if (round.phase === "done") {
    const outcome =
      round.outcome === "correct" ? (
        <>
          <TeamName view={view} id={round.teamId} /> got it
        </>
      ) : round.outcome === "stolen" ? (
        <>
          Stolen by <TeamName view={view} id={round.stealTeamId} />
        </>
      ) : (
        "Nobody got it"
      );
    return (
      <div className="d-conn-foot d-conn-done">
        <div className={`d-conn-answer is-${round.outcome ?? "missed"}`}>
          <span className="d-conn-answer-label">
            {round.type === "sequence" ? "Sequence" : "Connection"}
          </span>
          <span className="d-conn-answer-text">{round.connection}</span>
        </div>
        <div className="d-conn-outcome">{outcome}</div>
      </div>
    );
  }
  return <div className="d-conn-foot" />;
}
