import { useState } from "react";
import type { Team } from "../../../shared/content";
import { WALL_LIVES } from "../../../shared/game";
import type { WallView } from "../../../shared/view";
import { type Act, ActionBar, Btn, Card, ConfirmBtn, haptic } from "../ui";
import { SlotPicker } from "./SlotPicker";

const LIFE_KEYS = ["a", "b", "c", "d", "e"];
const WALL_COLORS = ["var(--wall-1)", "var(--wall-2)", "var(--wall-3)", "var(--wall-4)"];

export function WallPanel({
  r,
  teams,
  turnTeam,
  act,
}: {
  r: WallView;
  teams: Team[];
  turnTeam: Team | undefined;
  act: Act;
}) {
  const [hints, setHints] = useState(true);
  const team = teams.find((t) => t.id === r.teamId);

  if (r.phase === "pick") {
    return <SlotPicker slots={r.slots} turnTeam={turnTeam} act={act} noun="wall" />;
  }

  // Found groups in found order (tiles arrive found-first, grouped).
  const foundOrder: number[] = [];
  for (const t of r.tiles) {
    if (t.found && t.group !== null && !foundOrder.includes(t.group)) foundOrder.push(t.group);
  }
  const resolved = r.phase !== "play";

  const header = (
    <div className="h-wall-head">
      {team && (
        <span className="h-turntag" style={{ background: team.color }}>
          {team.name}
        </span>
      )}
      <span>
        Found <b>{r.foundCount}</b>/4
      </span>
      <span className="h-lives" title="Lives">
        {r.lives === null
          ? "Unlimited tries"
          : LIFE_KEYS.slice(0, WALL_LIVES).map((k, i) => (
              <i key={k} className={i < (r.lives ?? 0) ? "on" : ""} />
            ))}
      </span>
    </div>
  );

  const grid = (
    <div className={`h-wall${r.phase === "play" ? "" : " resolved"}`}>
      {r.tiles.map((t) => {
        const sel = r.selected.includes(t.id);
        const fi = t.group !== null ? foundOrder.indexOf(t.group) : -1;
        const bg = t.found
          ? WALL_COLORS[fi]
          : resolved && t.group !== null
            ? "var(--exun-slate)"
            : undefined;
        const hint = hints && !t.found && t.group !== null ? WALL_COLORS[t.group] : undefined;
        return (
          <button
            type="button"
            key={t.id}
            className={`h-tile${sel ? " sel" : ""}${t.found ? " found" : ""}`}
            disabled={r.phase !== "play" || t.found}
            style={{
              ...(bg ? { background: bg } : {}),
              ...(hint ? { boxShadow: `inset 0 -6px 0 ${hint}` } : {}),
            }}
            onClick={() => {
              haptic();
              act({ type: "tapTile", tileId: t.id });
            }}
          >
            {t.text}
          </button>
        );
      })}
    </div>
  );

  if (r.phase === "play") {
    return (
      <>
        <Card>
          {header}
          {grid}
          <div className="h-wall-tools">
            <Btn tone="ghost" active={hints} onClick={() => setHints((h) => !h)}>
              {hints ? "Hide group hints" : "Show group hints"}
            </Btn>
            <span className="h-muted h-small">{r.selected.length}/4 selected</span>
          </div>
        </Card>
        <ActionBar>
          <ConfirmBtn
            big
            className="h-span2"
            confirmLabel="Tap again to resolve the wall"
            onConfirm={() => act({ type: "resolveWall" })}
          >
            Resolve wall
          </ConfirmBtn>
        </ActionBar>
      </>
    );
  }

  const groupRows = [0, 1, 2, 3].map((g) => {
    const tiles = r.tiles.filter((t) => t.group === g);
    const fi = foundOrder.indexOf(g);
    const c = r.connections[g];
    return { g, tiles, found: fi >= 0, color: fi >= 0 ? WALL_COLORS[fi] : "var(--exun-slate)", c };
  });
  // Found groups first, in found order.
  groupRows.sort(
    (a, b) =>
      (a.found ? foundOrder.indexOf(a.g) : 9) - (b.found ? foundOrder.indexOf(b.g) : 9) ||
      a.g - b.g,
  );

  if (r.phase === "connections") {
    const marked = r.connections.filter((c) => c.correct !== null).length;
    return (
      <>
        <Card>
          {header}
          <p className="h-muted h-small">Mark each connection the team names.</p>
          <div className="h-groups">
            {groupRows.map(({ g, tiles, found, color, c }) => (
              <div key={g} className="h-group" style={{ borderColor: color }}>
                <div className="h-group-head" style={{ background: color }}>
                  <span>{c?.connection}</span>
                  <small>{found ? "found" : "not found"}</small>
                </div>
                <div className="h-group-clues">{tiles.map((t) => t.text).join(" · ")}</div>
                <div className="h-group-mark">
                  <Btn
                    tone={c?.correct === false ? "bad" : "ghost"}
                    active={c?.correct === false}
                    onClick={() => act({ type: "markConnection", group: g, correct: false })}
                  >
                    ✗ Wrong
                  </Btn>
                  <Btn
                    tone={c?.correct === true ? "ok" : "ghost"}
                    active={c?.correct === true}
                    onClick={() => act({ type: "markConnection", group: g, correct: true })}
                  >
                    ✓ Named
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <ActionBar>
          <div className="h-bar-title h-span2">
            {r.foundCount} group{r.foundCount === 1 ? "" : "s"} +{" "}
            {r.connections.filter((c) => c.correct).length} connections
            {r.foundCount === 4 && r.connections.every((c) => c.correct) ? " + 2 bonus" : ""} ={" "}
            <b>{r.score}</b>
            {marked < 4 ? ` · ${4 - marked} unmarked` : ""}
          </div>
          <ConfirmBtn
            big
            tone="ok"
            className="h-span2"
            needsConfirm={marked < 4}
            confirmLabel="Unmarked count as wrong — tap again"
            onConfirm={() => act({ type: "finishWall" })}
          >
            Finish &amp; score +{r.score}
          </ConfirmBtn>
        </ActionBar>
      </>
    );
  }

  // done
  return (
    <>
      <Card title="Wall scored">
        <p className="h-outcome ok">
          {team?.name ?? "Team"} scored <b>{r.score}</b>
        </p>
        <div className="h-groups">
          {groupRows.map(({ g, tiles, color, c }) => (
            <div key={g} className="h-group" style={{ borderColor: color }}>
              <div className="h-group-head" style={{ background: color }}>
                <span>{c?.connection}</span>
                <small>{c?.correct ? "✓" : "✗"}</small>
              </div>
              <div className="h-group-clues">{tiles.map((t) => t.text).join(" · ")}</div>
            </div>
          ))}
        </div>
      </Card>
      <ActionBar>
        <Btn big tone="primary" className="h-span2" onClick={() => act({ type: "backToPick" })}>
          Next team →
        </Btn>
      </ActionBar>
    </>
  );
}
