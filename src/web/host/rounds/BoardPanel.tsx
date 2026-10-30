import { useState } from "react";
import type { Team } from "../../../shared/content";
import type { BoardView } from "../../../shared/view";
import { type Act, ActionBar, Btn, Card, ConfirmBtn, haptic, TeamBtn } from "../ui";
import { AnswerBox, MediaThumb } from "./media";

function Tag({ team }: { team: Team | undefined }) {
  if (!team) return null;
  return (
    <span className="h-turntag" style={{ background: team.color }}>
      {team.name}
    </span>
  );
}

function BoardGrid({ r, turnTeam, act }: { r: BoardView; turnTeam: Team | undefined; act: Act }) {
  const cols = r.categories.length;
  const rows = Math.max(0, ...r.categories.map((c) => c.cells.length));
  const left = r.categories.reduce((n, c) => n + c.cells.filter((x) => !x.used).length, 0);
  return (
    <Card
      title={
        <>
          Pick a question
          <Tag team={turnTeam} />
        </>
      }
      right={<span className="h-muted h-small">{left} left</span>}
    >
      {left === 0 && <p className="h-muted">Board cleared. Go to the next round from Match.</p>}
      <div className="h-board" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {r.categories.map((c, ci) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: columns are fixed-position
          <div key={`h${ci}`} className="h-board-cat" title={c.name ?? undefined}>
            {c.name ?? "(missing)"}
          </div>
        ))}
        {Array.from({ length: rows }, (_, row) =>
          r.categories.map((c, ci) => {
            const cell = c.cells[row];
            const k = `${ci}-${row}`;
            if (!cell) return <div key={k} className="h-board-cell empty" />;
            return (
              <button
                type="button"
                key={k}
                className={`h-board-cell${cell.used ? " used" : ""}`}
                disabled={cell.used}
                aria-label={`${c.name ?? "Category"} for ${cell.points}`}
                onClick={() => {
                  haptic();
                  act({ type: "pickCell", category: ci, clue: row });
                }}
              >
                {cell.points}
              </button>
            );
          }),
        )}
      </div>
    </Card>
  );
}

export function BoardPanel({
  r,
  teams,
  turnTeam,
  act,
}: {
  r: BoardView;
  teams: Team[];
  turnTeam: Team | undefined;
  act: Act;
}) {
  const [stealTeam, setStealTeam] = useState<string | null>(null);

  if (r.phase === "pick" || !r.current) {
    return <BoardGrid r={r} turnTeam={turnTeam} act={act} />;
  }

  const cur = r.current;
  const pts = cur.points;
  const team = teams.find((t) => t.id === r.teamId);
  const wrongTeams = teams.filter((t) => r.wrong.includes(t.id));
  const stealPenalty = r.negative === "none" ? 0 : pts;

  const question = (
    <Card
      title={
        <>
          {cur.category}
          <Tag team={team} />
        </>
      }
      right={<span className="h-board-pts">{pts}</span>}
    >
      {cur.prompt.trim() && <p className="h-prompt">{cur.prompt}</p>}
      {cur.media && <MediaThumb media={cur.media} big={!cur.prompt.trim()} />}
      {cur.answer && (
        <AnswerBox
          className="h-answer-big"
          tag={`Answer${r.phase === "done" ? " · on screen" : ""}`}
          answer={cur.answer}
          media={cur.answerMedia}
        />
      )}
      {wrongTeams.length > 0 && (
        <p className="h-small h-board-wrong">✗ Wrong: {wrongTeams.map((t) => t.name).join(", ")}</p>
      )}
    </Card>
  );

  if (r.phase === "play") {
    return (
      <>
        {question}
        <ActionBar>
          <div className="h-points-now">
            Worth <b>{pts}</b>
          </div>
          <Btn big tone="bad" onClick={() => act({ type: "answerWrong" })}>
            ✗ Wrong
            <small>{r.negative === "all" ? `−${pts} · then steal` : "no penalty · steal"}</small>
          </Btn>
          <Btn big tone="ok" onClick={() => act({ type: "answerCorrect" })}>
            ✓ Correct +{pts}
          </Btn>
        </ActionBar>
      </>
    );
  }

  if (r.phase === "steal") {
    const open = teams.filter((t) => !r.wrong.includes(t.id));
    const chosen = open.find((t) => t.id === stealTeam);
    return (
      <>
        {question}
        <ActionBar>
          {!chosen ? (
            <>
              <div className="h-bar-title h-span2">
                Steal for {pts}
                {stealPenalty ? ` (−${pts} if wrong)` : " (no penalty)"} — who buzzed?
              </div>
              {open.map((t) => (
                <TeamBtn key={t.id} team={t} onClick={() => setStealTeam(t.id)} />
              ))}
              <ConfirmBtn
                tone="neutral"
                className="h-span2"
                confirmLabel="Tap again to close the question"
                onConfirm={() => act({ type: "steal", teamId: null, correct: false })}
              >
                No steal / close
              </ConfirmBtn>
            </>
          ) : (
            <>
              <div className="h-bar-title h-span2">
                <Tag team={chosen} /> stealing…
              </div>
              <Btn
                big
                tone="bad"
                onClick={() => {
                  act({ type: "steal", teamId: chosen.id, correct: false });
                  setStealTeam(null);
                }}
              >
                ✗ Wrong {stealPenalty ? `−${pts}` : "(0)"}
              </Btn>
              <Btn
                big
                tone="ok"
                onClick={() => {
                  act({ type: "steal", teamId: chosen.id, correct: true });
                  setStealTeam(null);
                }}
              >
                ✓ Correct +{pts}
              </Btn>
              <Btn className="h-span2" onClick={() => setStealTeam(null)}>
                ‹ Pick another team
              </Btn>
            </>
          )}
        </ActionBar>
      </>
    );
  }

  // done
  const winner = teams.find((t) => t.id === r.answeredBy);
  const outcome = !winner
    ? "Nobody got it"
    : winner.id === r.teamId
      ? `${winner.name} got it (+${pts})`
      : `Stolen by ${winner.name} (+${pts})`;
  return (
    <>
      <Card title="Result">
        <p className={`h-outcome ${winner ? "ok" : "bad"}`}>{outcome}</p>
      </Card>
      {question}
      <ActionBar>
        <Btn big tone="primary" className="h-span2" onClick={() => act({ type: "backToPick" })}>
          Back to board →
        </Btn>
      </ActionBar>
    </>
  );
}
