import { useState } from "react";
import type { Team } from "../../../shared/content";
import { CONNECTION_POINTS } from "../../../shared/game";
import type { ConnectionView } from "../../../shared/view";
import { type Act, ActionBar, Btn, Card, TeamBtn } from "../ui";
import { ClueBody } from "./media";
import { SlotPicker } from "./SlotPicker";

export function ConnectionPanel({
  r,
  teams,
  turnTeam,
  act,
}: {
  r: ConnectionView;
  teams: Team[];
  turnTeam: Team | undefined;
  act: Act;
}) {
  const [stealTeam, setStealTeam] = useState<string | null>(null);
  const seq = r.type === "sequence";
  const noun = seq ? "sequence" : "connection";
  const team = teams.find((t) => t.id === r.teamId);

  if (r.phase === "pick") {
    return <SlotPicker slots={r.slots} turnTeam={turnTeam} act={act} noun={noun} />;
  }

  const maxShown = seq ? 3 : 4;
  const nextPts = CONNECTION_POINTS[r.shown] ?? null;

  const clues = (
    <Card
      title={
        <>
          {r.label || (seq ? "Sequence" : "Connection")}
          {team && (
            <span className="h-turntag" style={{ background: team.color, color: "#fff" }}>
              {team.name}
            </span>
          )}
        </>
      }
      right={<span className="h-muted h-small">{r.shown} shown</span>}
    >
      <ol className="h-clues">
        {r.clues.map((c, i) => {
          const shown = i < r.shown && !(seq && i === 3 && r.phase !== "done");
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: clues are fixed-position
            <li key={i} className={shown ? "shown" : "hidden"}>
              <span className="h-clue-n">{i + 1}</span>
              <span className="h-clue-body">
                <ClueBody clue={c} />
              </span>
              <span className="h-clue-state">
                {seq && i === 3 ? "answer" : shown ? "on screen" : "hidden"}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="h-answer">
        <span className="h-answer-tag">{seq ? "Connection" : "Answer"}</span>
        <span>{r.connection}</span>
      </div>
      {r.explanation && <p className="h-explain">{r.explanation}</p>}
    </Card>
  );

  if (r.phase === "play") {
    return (
      <>
        {clues}
        <ActionBar>
          <div className="h-points-now">
            Worth <b>{r.pointsNow}</b>
          </div>
          <Btn
            big
            tone="primary"
            className="h-span2"
            disabled={r.shown >= maxShown}
            onClick={() => act({ type: "nextClue" })}
          >
            {r.shown >= maxShown
              ? "All clues shown"
              : `Next clue → ${nextPts} pt${nextPts === 1 ? "" : "s"}`}
          </Btn>
          <Btn big tone="bad" onClick={() => act({ type: "answerWrong" })}>
            ✗ Wrong
          </Btn>
          <Btn big tone="ok" onClick={() => act({ type: "answerCorrect" })}>
            ✓ Correct +{r.pointsNow}
          </Btn>
        </ActionBar>
      </>
    );
  }

  if (r.phase === "steal") {
    const others = teams.filter((t) => t.id !== r.teamId);
    const chosen = teams.find((t) => t.id === stealTeam);
    return (
      <>
        {clues}
        <ActionBar>
          {!chosen ? (
            <>
              <div className="h-bar-title h-span2">Steal for 1 — who buzzed?</div>
              {others.map((t) => (
                <TeamBtn key={t.id} team={t} onClick={() => setStealTeam(t.id)} />
              ))}
              <Btn
                className="h-span2"
                onClick={() => act({ type: "steal", teamId: null, correct: false })}
              >
                No steal
              </Btn>
            </>
          ) : (
            <>
              <div className="h-bar-title h-span2">
                <span className="h-turntag" style={{ background: chosen.color }}>
                  {chosen.name}
                </span>{" "}
                stealing…
              </div>
              <Btn
                big
                tone="bad"
                onClick={() => {
                  act({ type: "steal", teamId: chosen.id, correct: false });
                  setStealTeam(null);
                }}
              >
                ✗ Wrong
              </Btn>
              <Btn
                big
                tone="ok"
                onClick={() => {
                  act({ type: "steal", teamId: chosen.id, correct: true });
                  setStealTeam(null);
                }}
              >
                ✓ Correct +1
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
  const stealer = teams.find((t) => t.id === r.stealTeamId);
  const outcome =
    r.outcome === "correct"
      ? `${team?.name ?? "Team"} got it`
      : r.outcome === "stolen"
        ? `Stolen by ${stealer?.name ?? "?"} (+1)`
        : stealer
          ? `Missed — ${stealer.name}'s steal was wrong`
          : "Nobody got it";
  return (
    <>
      <Card title="Result">
        <p className={`h-outcome ${r.outcome === "missed" ? "bad" : "ok"}`}>{outcome}</p>
      </Card>
      {clues}
      <ActionBar>
        <Btn big tone="primary" className="h-span2" onClick={() => act({ type: "backToPick" })}>
          Next team →
        </Btn>
      </ActionBar>
    </>
  );
}
