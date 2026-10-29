import { useState } from "react";
import { ROUND_TYPE_LABELS } from "../../shared/content";
import type { GameView } from "../../shared/view";
import { type Act, Btn, Card, ConfirmBtn } from "./ui";

/** Match control: start a match, jump between rounds, end the match. */
export function MatchSheet({
  view,
  act,
  onClose,
}: {
  view: GameView;
  act: Act;
  onClose: () => void;
}) {
  const matches = view.matches ?? [];
  const [pick, setPick] = useState<string>(view.match?.id ?? matches[0]?.id ?? "");
  const live = view.round !== null;

  return (
    <div className="h-sheet" role="dialog" aria-label="Match control">
      <div className="h-sheet-head">
        <h2>Match</h2>
        <Btn onClick={onClose} aria-label="Close match control">
          Close ✕
        </Btn>
      </div>
      <div className="h-sheet-body">
        {view.match && (
          <Card title="Rounds" right={<span className="h-muted">{view.match.name}</span>}>
            {view.match.rounds.length === 0 && <p className="h-muted">This match has no rounds.</p>}
            <ol className="h-roundlist">
              {view.match.rounds.map((r, i) => {
                const current = view.roundIndex === i;
                return (
                  <li key={r.id} className={current ? "current" : ""}>
                    <span className="h-roundlist-n">{i + 1}</span>
                    <span className="h-roundlist-title">
                      {r.title}
                      <small>{ROUND_TYPE_LABELS[r.type]}</small>
                    </span>
                    <ConfirmBtn
                      tone={current ? "ghost" : "primary"}
                      needsConfirm={live}
                      confirmLabel={current ? "Restart?" : "Leave live round?"}
                      onConfirm={() => {
                        act({ type: "goToRound", index: i });
                        onClose();
                      }}
                    >
                      {current ? "Restart" : "Go"}
                    </ConfirmBtn>
                  </li>
                );
              })}
            </ol>
          </Card>
        )}

        <Card title={view.match ? "Switch match" : "Start a match"}>
          {matches.length === 0 ? (
            <p className="h-muted">No matches yet. Create one in /admin.</p>
          ) : (
            <>
              <div className="h-matchpick">
                {matches.map((m) => (
                  <Btn
                    key={m.id}
                    active={pick === m.id}
                    tone={pick === m.id ? "primary" : "ghost"}
                    onClick={() => setPick(m.id)}
                  >
                    {m.name}
                    {view.match?.id === m.id ? " (current)" : ""}
                  </Btn>
                ))}
              </div>
              <ConfirmBtn
                big
                tone="primary"
                disabled={!pick}
                confirmLabel={view.match ? "Tap again: resets scores" : "Tap again to start"}
                onConfirm={() => {
                  act({ type: "startMatch", matchId: pick });
                  onClose();
                }}
              >
                Start {matches.find((m) => m.id === pick)?.name ?? "match"}
              </ConfirmBtn>
              {view.match && (
                <p className="h-muted h-small">
                  Starting a match resets its scores. End the current match first to keep its scores
                  on the leaderboard.
                </p>
              )}
            </>
          )}
        </Card>

        {view.match && (
          <Card title="End match">
            <ConfirmBtn
              big
              tone="bad"
              confirmLabel="Tap again to END match"
              onConfirm={() => {
                act({ type: "endMatch" });
                onClose();
              }}
            >
              End {view.match.name}
            </ConfirmBtn>
            <p className="h-muted h-small">Saves the scores to the leaderboard.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
