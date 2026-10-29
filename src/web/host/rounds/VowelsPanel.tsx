import type { Team } from "../../../shared/content";
import type { VowelsView } from "../../../shared/view";
import { type Act, ActionBar, Btn, Card, TeamBtn } from "../ui";

export function VowelsPanel({ r, teams, act }: { r: VowelsView; teams: Team[]; act: Act }) {
  const onClue = r.clueIndex >= 0;
  const lastClue = r.clueIndex + 1 >= r.clueCount;
  const lastCat = r.categoryIndex + 1 >= r.categoryCount;
  const nextLabel = !onClue
    ? "Show first clue"
    : !lastClue
      ? "Next clue"
      : !lastCat
        ? "Next category"
        : "End round";

  const catCard = (
    <Card
      title={`Category ${Math.min(r.categoryIndex + 1, r.categoryCount)} / ${r.categoryCount}`}
      right={
        onClue ? (
          <span className="h-muted h-small">
            Clue {r.clueIndex + 1} / {r.clueCount}
          </span>
        ) : null
      }
    >
      <p className="h-vowels-cat">{r.category ?? "(no categories)"}</p>
      {r.nextCategory && <p className="h-muted h-small">Up next: {r.nextCategory}</p>}
    </Card>
  );

  if (!r.started) {
    return (
      <>
        {catCard}
        <ActionBar>
          <Btn
            big
            tone="primary"
            className="h-span2"
            disabled={r.categoryCount === 0}
            onClick={() => act({ type: "vowelsStart" })}
          >
            Start round ▶ (starts timer)
          </Btn>
        </ActionBar>
      </>
    );
  }

  if (r.ended) {
    return (
      <>
        <Card title="Missing Vowels">
          <p className="h-outcome">Round over</p>
          {onClue && r.answer && (
            <p className="h-muted">
              Last clue: {r.puzzle} → {r.answer}
            </p>
          )}
        </Card>
        {onClue && !r.revealed && (
          <ActionBar>
            <Btn className="h-span2" tone="warn" onClick={() => act({ type: "vowelsReveal" })}>
              Reveal last answer
            </Btn>
          </ActionBar>
        )}
      </>
    );
  }

  const buzzed = teams.find((t) => t.id === r.buzzed);
  const correct = teams.find((t) => t.id === r.correctTeamId);

  return (
    <>
      {catCard}
      {onClue && (
        <Card>
          <p className="h-vowels-puzzle">{r.puzzle}</p>
          <p className="h-vowels-answer">{r.answer}</p>
          {r.revealed && (
            <p className={`h-small ${correct ? "h-oktext" : "h-muted"}`}>
              {correct ? `✓ ${correct.name} +1` : "Revealed"}
            </p>
          )}
        </Card>
      )}
      <ActionBar>
        {onClue && !r.revealed && !buzzed && (
          <>
            <div className="h-bar-title h-span2">Who buzzed?</div>
            {teams.map((t) => {
              const out = r.wrong.includes(t.id);
              return (
                <TeamBtn
                  key={t.id}
                  team={t}
                  big
                  disabled={out}
                  className={out ? "h-out" : ""}
                  onClick={() => act({ type: "vowelsBuzz", teamId: t.id })}
                >
                  {out ? `✗ ${t.name}` : t.name}
                </TeamBtn>
              );
            })}
          </>
        )}
        {onClue && buzzed && (
          <>
            <div className="h-bar-title h-span2 h-buzzed" style={{ borderLeftColor: buzzed.color }}>
              {buzzed.name} buzzed
            </div>
            <Btn
              big
              tone="bad"
              className="h-huge"
              onClick={() => act({ type: "vowelsJudge", correct: false })}
            >
              ✗ −1
            </Btn>
            <Btn
              big
              tone="ok"
              className="h-huge"
              onClick={() => act({ type: "vowelsJudge", correct: true })}
            >
              ✓ +1
            </Btn>
            <Btn className="h-span2" onClick={() => act({ type: "vowelsBuzz", teamId: null })}>
              Cancel buzz
            </Btn>
          </>
        )}
        {onClue && !r.revealed && !buzzed && (
          <Btn tone="warn" onClick={() => act({ type: "vowelsReveal" })}>
            Reveal
          </Btn>
        )}
        {!buzzed && (
          <Btn
            tone="primary"
            className={onClue && !r.revealed ? "" : "h-span2"}
            big={!onClue || r.revealed}
            onClick={() => act({ type: "vowelsNext" })}
          >
            {nextLabel} →
          </Btn>
        )}
      </ActionBar>
    </>
  );
}
