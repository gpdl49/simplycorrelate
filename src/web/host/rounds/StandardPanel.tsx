import type { Team } from "../../../shared/content";
import type { StandardView } from "../../../shared/view";
import { type Act, ActionBar, Btn, Card } from "../ui";
import { AnswerBox, MediaThumb } from "./media";

export function StandardPanel({ r, teams, act }: { r: StandardView; teams: Team[]; act: Act }) {
  return (
    <>
      <Card
        title={`Question ${r.index + 1} / ${r.total}`}
        right={r.label ? <span className="h-muted">{r.label}</span> : null}
      >
        {r.prompt.trim() && <p className="h-prompt">{r.prompt}</p>}
        {r.media && <MediaThumb media={r.media} big={!r.prompt.trim()} />}
        <AnswerBox
          tag={`Answer${r.revealed ? " · on screen" : " · hidden"}`}
          answer={r.answer ?? ""}
          media={r.answerMedia}
        />
        <p className="h-muted h-small">
          {r.points} pt{r.points === 1 ? "" : "s"}
          {r.penalty > 0 ? ` · −${r.penalty} for a wrong answer` : ""}
        </p>
      </Card>

      <Card title="Award" right={<span className="h-muted h-small">tap again to remove</span>}>
        <div className="h-teamgrid">
          {teams.map((t) => {
            const on = r.awarded.includes(t.id);
            return (
              <Btn
                key={t.id}
                tone={on ? "ok" : "ghost"}
                active={on}
                aria-pressed={on}
                className="h-teamedge"
                style={{ borderLeftColor: t.color }}
                onClick={() => act({ type: "standardAward", teamId: t.id })}
              >
                {on ? "✓ " : "+ "}
                {t.name}
                <small>{on ? `+${r.points} awarded` : `+${r.points}`}</small>
              </Btn>
            );
          })}
        </div>
      </Card>

      {r.penalty > 0 && (
        <Card title="Penalise">
          <div className="h-teamgrid">
            {teams.map((t) => {
              const on = r.penalised.includes(t.id);
              return (
                <Btn
                  key={t.id}
                  tone={on ? "bad" : "ghost"}
                  active={on}
                  aria-pressed={on}
                  onClick={() => act({ type: "standardPenalise", teamId: t.id })}
                  className="h-teamedge"
                  style={{ borderLeftColor: t.color }}
                >
                  {on ? "✗ " : ""}
                  {t.name} −{r.penalty}
                </Btn>
              );
            })}
          </div>
        </Card>
      )}

      <ActionBar cols={3}>
        <Btn
          disabled={r.index === 0}
          onClick={() => act({ type: "standardGo", index: r.index - 1 })}
        >
          ‹ Prev
        </Btn>
        <Btn
          tone={r.revealed ? "ghost" : "warn"}
          onClick={() => act({ type: "standardReveal", revealed: !r.revealed })}
        >
          {r.revealed ? "Hide answer" : "Reveal answer"}
        </Btn>
        <Btn
          tone="primary"
          disabled={r.index + 1 >= r.total}
          onClick={() => act({ type: "standardGo", index: r.index + 1 })}
        >
          Next ›
        </Btn>
      </ActionBar>
    </>
  );
}
