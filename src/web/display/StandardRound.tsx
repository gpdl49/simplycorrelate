import { type RefObject, useLayoutEffect, useRef } from "react";
import type { GameView, StandardView } from "../../shared/view";
import { type Mark, RoundFrame } from "./chrome";
import { AnswerMedia, MediaView, useImageRatio } from "./Media";

/** Starting prompt size in --u; useFitText shrinks it if it overflows its box. */
function promptSize(text: string): number {
  const n = text.length;
  return n < 60 ? 4.4 : n < 120 ? 3.6 : n < 220 ? 2.9 : 2.4;
}

/** A prompt this short sits above the image as a caption rather than beside it. */
const CAPTION_MAX = 80;

/** Sets the element's font size to `max` --u, then steps down to `min` until its parent no longer overflows. */
function useFitText(ref: RefObject<HTMLElement | null>, max: number, min: number, key: unknown) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` re-fits when the content changes
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const shrink = () => {
      let size = max;
      el.style.fontSize = `calc(var(--u) * ${size})`;
      while (size > min && box.scrollHeight > box.clientHeight + 1) {
        size = Math.max(min, size - 0.1);
        el.style.fontSize = `calc(var(--u) * ${size})`;
      }
    };
    shrink();
    const ro = new ResizeObserver(shrink);
    ro.observe(box);
    return () => ro.disconnect();
  }, [ref, max, min, key]);
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
  const promptRef = useRef<HTMLParagraphElement>(null);
  const ratio = useImageRatio(round.media);
  const prompt = round.prompt.trim();
  const layout = !round.media
    ? "text"
    : !prompt
      ? "solo"
      : prompt.length <= CAPTION_MAX
        ? "caption"
        : "split";
  const base = promptSize(prompt);
  useFitText(
    promptRef,
    layout === "split" ? Math.min(base, 3) : layout === "caption" ? base * 0.8 : base,
    1.6,
    `${round.index}|${prompt}|${layout}|${ratio}|${round.revealed}`,
  );
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
      <div className={`d-std is-${layout}`} key={round.index}>
        <div className="d-std-body">
          <div
            className="d-std-q"
            style={ratio ? ({ "--ar": ratio } as React.CSSProperties) : undefined}
          >
            {prompt && (
              <div className="d-std-text">
                <p ref={promptRef} className="d-std-prompt">
                  {round.prompt}
                </p>
              </div>
            )}
            {round.media && (
              <div className="d-std-media d-fit">
                <MediaView media={round.media} fit />
              </div>
            )}
          </div>
        </div>
        <div className={`d-std-answer${round.revealed ? " is-shown" : ""}`}>
          {round.revealed && round.answer !== undefined && (
            <>
              {round.answerMedia && <AnswerMedia media={round.answerMedia} />}
              <span className="d-std-answer-words">
                <span className="d-std-answer-label">Answer</span>
                <span className="d-std-answer-text">{round.answer}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </RoundFrame>
  );
}
