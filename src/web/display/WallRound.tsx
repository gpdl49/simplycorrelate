import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GameView, TileView, WallView } from "../../shared/view";
import { GlyphGrid } from "./ConnectionRound";
import { type Mark, RoundFrame, TeamName, TimerClock } from "./chrome";

function tileSize(text: string, scale = 1): string {
  const longest = Math.max(...text.split(/\s+/).map((w) => w.length));
  const n = text.length;
  let s = n < 10 ? 2.4 : n < 18 ? 2.1 : n < 30 ? 1.8 : 1.5;
  if (longest > 11) s = Math.min(s, 1.6);
  return `calc(var(--u) * ${(s * scale).toFixed(2)})`;
}

/** Animates tiles sliding to their new positions (FLIP) when found groups move to the top. */
function useFlip() {
  const els = useRef(new Map<string, HTMLElement>());
  const prev = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    for (const [id, el] of els.current) {
      const r = el.getBoundingClientRect();
      next.set(id, r);
      const p = prev.current.get(id);
      if (p && (Math.abs(p.left - r.left) > 1 || Math.abs(p.top - r.top) > 1)) {
        el.animate(
          [
            { transform: `translate(${p.left - r.left}px, ${p.top - r.top}px)` },
            { transform: "none" },
          ],
          { duration: 550, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      }
    }
    prev.current = next;
  });
  return (id: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };
}

function useShake(count: number): boolean {
  const last = useRef(count);
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (count > last.current) {
      setShaking(true);
      const t = window.setTimeout(() => setShaking(false), 520);
      last.current = count;
      return () => window.clearTimeout(t);
    }
    last.current = count;
  }, [count]);
  return shaking;
}

function Lives({ lives }: { lives: number | null }) {
  if (lives === null) return null;
  return (
    <span className="d-lives" title={`${lives} lives`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`d-life${i < lives ? " is-on" : ""}`} />
      ))}
    </span>
  );
}

function Tile({
  tile,
  colour,
  selected,
  flipRef,
  compact = false,
}: {
  compact?: boolean;
  tile: TileView;
  colour: number | null;
  selected: boolean;
  flipRef: (el: HTMLElement | null) => void;
}) {
  return (
    <div
      ref={flipRef}
      className={`d-tile${selected ? " is-selected" : ""}${colour !== null ? " is-grouped" : ""}${
        tile.found ? " is-found" : ""
      }`}
      style={
        colour !== null
          ? ({ "--g": `var(--wall-${colour + 1})` } as React.CSSProperties)
          : undefined
      }
    >
      <span style={{ fontSize: tileSize(tile.text, compact ? 0.72 : 1) }}>{tile.text}</span>
    </div>
  );
}

export function WallRound({
  view,
  round,
  title,
  clockOffset,
}: {
  view: GameView;
  round: WallView;
  title: string;
  clockOffset: number;
}) {
  const flip = useFlip();
  const shaking = useShake(round.wrongCount);
  const resolved = round.phase === "connections" || round.phase === "done";

  const marks: Record<string, Mark> = {};
  if (round.phase === "done" && round.teamId)
    marks[round.teamId] = { tone: "ok", text: `+${round.score}` };
  const active = round.phase === "pick" ? view.turnTeamId : round.teamId;

  const rows = [0, 1, 2, 3].map((r) => round.tiles.slice(r * 4, r * 4 + 4));

  return (
    <RoundFrame
      view={view}
      title={title}
      info={
        round.phase === "pick" ? null : (
          <span className="d-wall-info">
            <TeamName view={view} id={round.teamId} />
            {resolved && (
              <span className="d-pill">
                Score <b>{round.score}</b>
              </span>
            )}
          </span>
        )
      }
      right={
        round.phase === "play" ? (
          <span className="d-wall-right">
            <Lives lives={round.lives} />
            <TimerClock timer={round.timer} clockOffset={clockOffset} />
          </span>
        ) : null
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
          prompt="choose a wall"
        />
      ) : resolved ? (
        <div className="d-wall-resolved">
          {rows.map((tiles, r) => {
            const group = tiles[0]?.group ?? r;
            const found = !!tiles[0]?.found;
            const conn = round.connections[group];
            const show = round.phase === "done" || (conn && conn.correct !== null);
            return (
              <div key={group} className={`d-wall-row${found ? "" : " is-unfound"}`}>
                <div className="d-wall-row-tiles">
                  {tiles.map((t) => (
                    <Tile
                      key={t.id}
                      tile={t}
                      colour={r}
                      selected={false}
                      flipRef={flip(t.id)}
                      compact
                    />
                  ))}
                </div>
                <div
                  className={`d-wall-conn${show ? " is-shown" : ""}${
                    conn?.correct === true ? " is-ok" : conn?.correct === false ? " is-bad" : ""
                  }`}
                  style={{ "--g": `var(--wall-${r + 1})` } as React.CSSProperties}
                >
                  {show && conn?.connection ? (
                    <>
                      <span className="d-wall-conn-text">{conn.connection}</span>
                      {conn.correct !== null && (
                        <span className="d-wall-conn-mark">{conn.correct ? "✓" : "✗"}</span>
                      )}
                    </>
                  ) : (
                    <span className="d-wall-conn-wait">?</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`d-wall${shaking ? " is-shaking" : ""}`}>
          {round.tiles.map((t, i) => (
            <Tile
              key={t.id}
              tile={t}
              colour={t.found ? Math.floor(i / 4) : null}
              selected={round.selected.includes(t.id)}
              flipRef={flip(t.id)}
            />
          ))}
        </div>
      )}
    </RoundFrame>
  );
}
