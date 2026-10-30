import { useLayoutEffect, useRef } from "react";
import type { BoardView, GameView } from "../../shared/view";
import { type Mark, RoundFrame, TeamName, TimerClock } from "./chrome";
import { AnswerMedia, MediaView } from "./Media";

const HEAD_H = 6.4;

/** Category name in Michroma, shrunk (by measuring) until it fits its header cell without breaking words. */
function HeaderText({ text, cols }: { text: string; cols: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refit when the name or column width changes
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const shrink = () => {
      el.classList.remove("is-squeezed");
      const maxH = box.clientHeight * 0.9;
      for (let s = 2.1; s >= 0.7; s -= 0.05) {
        el.style.fontSize = `calc(var(--u) * ${s.toFixed(2)})`;
        if (el.scrollWidth <= el.clientWidth + 1 && el.offsetHeight <= maxH) return;
      }
      el.classList.add("is-squeezed");
    };
    shrink();
    let live = true;
    void document.fonts?.ready.then(() => live && shrink());
    window.addEventListener("resize", shrink);
    return () => {
      live = false;
      window.removeEventListener("resize", shrink);
    };
  }, [text, cols]);
  return (
    <span ref={ref} className="d-bd-head-text">
      {text}
    </span>
  );
}

function promptSize(text: string, hasMedia: boolean, done: boolean): string {
  const n = text.length;
  let s = n < 50 ? 5 : n < 120 ? 4.2 : n < 200 ? 3.3 : 2.5;
  if (hasMedia) s *= 0.8;
  if (done) s *= 0.75;
  return `calc(var(--u) * ${s})`;
}

function Board({ view, round }: { view: GameView; round: BoardView }) {
  const cols = Math.max(round.categories.length, 1);
  const rows = Math.max(1, ...round.categories.map((c) => c.cells.length));
  return (
    <div className="d-bd">
      <p className="d-pick-prompt">
        <TeamName view={view} id={view.turnTeamId} />
        {view.turnTeamId ? ", choose a category" : "Choose a category"}
      </p>
      <div
        className="d-bd-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `calc(var(--u) * ${HEAD_H}) repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {round.categories.map((c, ci) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
            key={`h${ci}`}
            className="d-bd-head"
            style={{ gridColumn: ci + 1, gridRow: 1 }}
          >
            <HeaderText text={c.name ?? "—"} cols={cols} />
          </div>
        ))}
        {round.categories.flatMap((c, ci) =>
          c.cells.map((cell, ri) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
              key={`${ci}-${ri}`}
              data-cell={`${ci}-${ri}`}
              className={`d-bd-cell${cell.used ? " is-used" : ""}`}
              style={{ gridColumn: ci + 1, gridRow: ri + 2, animationDelay: `${ri * 0.04}s` }}
            >
              {!cell.used && <span className="d-bd-points">{cell.points}</span>}
            </div>
          )),
        )}
      </div>
    </div>
  );
}

/** The selected question, zoomed up from its board cell. */
function QuestionCard({
  view,
  round,
  zoomFrom,
}: {
  view: GameView;
  round: BoardView;
  zoomFrom: DOMRect | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !zoomFrom) return;
    const to = el.getBoundingClientRect();
    const dx = zoomFrom.left - to.left;
    const dy = zoomFrom.top - to.top;
    const sx = zoomFrom.width / to.width;
    const sy = zoomFrom.height / to.height;
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: "4%" },
        { transform: "none" },
      ],
      { duration: 650, easing: "cubic-bezier(0.6, 0, 0.2, 1)" },
    );
    // Only on the zoom in.
  }, [zoomFrom]);

  const cur = round.current;
  if (!cur) return null;
  const done = round.phase === "done";
  const lose = round.negative !== "none";
  return (
    <div ref={ref} className={`d-bd-card is-${round.phase}`}>
      <div className={`d-bd-card-body${zoomFrom ? " is-zoomed" : ""}`}>
        <div className="d-bd-card-top">
          <span className="d-bd-card-cat">{cur.category}</span>
          <span className="d-bd-card-pts">{cur.points}</span>
        </div>
        <div className="d-bd-card-main">
          {cur.prompt.trim() && (
            <p
              className="d-bd-prompt"
              style={{ fontSize: promptSize(cur.prompt, !!cur.media, done) }}
            >
              {cur.prompt}
            </p>
          )}
          {cur.media && (
            <div
              className={`d-bd-media${done ? " is-small" : ""}${cur.prompt.trim() ? "" : " is-solo"}`}
            >
              <MediaView media={cur.media} />
            </div>
          )}
        </div>
        <div className="d-bd-foot">
          {round.phase === "play" && (
            <div className="d-bd-turn">
              <TeamName view={view} id={round.teamId} /> to answer
              {round.negative === "all" && (
                <span className="d-bd-neg">Wrong answers lose {cur.points}</span>
              )}
            </div>
          )}
          {round.phase === "steal" && (
            <div className="d-bd-steal">
              <span className="d-bd-steal-title">Open to all teams</span>
              <div className="d-bd-steal-teams">
                {view.teams.map((t) => (
                  <span
                    key={t.id}
                    className={`d-bd-steal-team${round.wrong.includes(t.id) ? " is-out" : ""}`}
                  >
                    <TeamName view={view} id={t.id} />
                  </span>
                ))}
              </div>
              {lose && <span className="d-bd-neg">Wrong answers lose {cur.points}</span>}
            </div>
          )}
          {done && (
            <div className="d-bd-done">
              <div
                className={`d-bd-answer${round.answeredBy ? "" : " is-missed"}${cur.answerMedia ? " has-media" : ""}`}
              >
                {cur.answerMedia && <AnswerMedia media={cur.answerMedia} />}
                <span className="d-bd-answer-words">
                  <span className="d-conn-answer-label">Answer</span>
                  <span className="d-conn-answer-text">{cur.answer}</span>
                </span>
              </div>
              <div className="d-conn-outcome">
                {round.answeredBy ? (
                  <>
                    <TeamName view={view} id={round.answeredBy} /> scores {cur.points}
                  </>
                ) : (
                  "No one"
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BoardRound({
  view,
  round,
  title,
  clockOffset,
}: {
  view: GameView;
  round: BoardView;
  title: string;
  clockOffset: number;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // Capture the picked cell's rect while the board is still on screen, so the card can zoom from it.
  const prevPhase = useRef(round.phase);
  const zoomFrom = useRef<DOMRect | null>(null);
  if (prevPhase.current !== round.phase) {
    if (prevPhase.current === "pick" && round.phase === "play" && round.cell) {
      const el = bodyRef.current?.querySelector(
        `[data-cell="${round.cell.category}-${round.cell.clue}"]`,
      );
      zoomFrom.current = el ? el.getBoundingClientRect() : null;
    } else if (round.phase === "pick") {
      zoomFrom.current = null;
    }
    prevPhase.current = round.phase;
  }

  const points = round.current?.points ?? 0;
  const marks: Record<string, Mark> = {};
  if (round.phase === "steal" || round.phase === "done") {
    for (const t of round.wrong) {
      const deducted =
        round.negative === "all" || (round.negative === "steals" && t !== round.teamId);
      marks[t] = { tone: "bad", text: deducted ? `−${points}` : "✗" };
    }
  }
  if (round.phase === "done" && round.answeredBy)
    marks[round.answeredBy] = { tone: "ok", text: `+${points}` };

  const active =
    round.phase === "pick" ? view.turnTeamId : round.phase === "play" ? round.teamId : null;
  const playing = round.phase === "play";

  return (
    <RoundFrame
      view={view}
      title={title}
      info={
        playing ? (
          <span>
            <TeamName view={view} id={round.teamId} />
          </span>
        ) : null
      }
      right={playing ? <TimerClock timer={round.timer} clockOffset={clockOffset} /> : null}
      timer={playing ? round.timer : null}
      clockOffset={clockOffset}
      active={active}
      marks={marks}
    >
      <div ref={bodyRef} className={`d-bd-wrap${round.phase !== "pick" ? " has-card" : ""}`}>
        <Board view={view} round={round} />
        {round.phase !== "pick" && (
          <QuestionCard view={view} round={round} zoomFrom={zoomFrom.current} />
        )}
      </div>
    </RoundFrame>
  );
}
