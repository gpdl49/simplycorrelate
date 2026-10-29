import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  DEFAULT_TIMER_SEC,
  GLYPHS,
  type Match,
  NEGATIVE_MARKING,
  type NegativeMarking,
  QUESTION_TYPE_FOR_ROUND,
  type Question,
  ROUND_TYPE_LABELS,
  ROUND_TYPES,
  type Round,
  type RoundType,
  type Team,
} from "../../shared/content";
import { TeamPicker } from "./MatchesPage";
import {
  usageMap,
  useLockMatch,
  useMatches,
  useQuestions,
  useSaveMatch,
  useTeams,
} from "./queries";
import { Banner, questionSummary, TypeBadge } from "./ui";

/** Max questions per round; null = unlimited. The game shows at most six walls. */
const ROUND_MAX: Record<RoundType, number | null> = {
  standard: null,
  connection: GLYPHS.length,
  sequence: GLYPHS.length,
  wall: 6,
  vowels: null,
  board: 6,
};

const NEGATIVE_LABELS: Record<NegativeMarking, string> = {
  none: "None",
  steals: "Steals only",
  all: "All wrong answers",
};

/** The question type a round slot shows without a type badge. */
function exactType(round: RoundType): Question["type"] {
  return round === "board" ? "category" : round;
}

function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = arr.slice();
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

/** Question types a round can draw from; the engine accepts connection and sequence questions in either round. */
function eligible(round: RoundType, q: Question): boolean {
  const t = QUESTION_TYPE_FOR_ROUND[round];
  if (t === "connection" || t === "sequence")
    return q.type === "connection" || q.type === "sequence";
  return q.type === t;
}

export function MatchEditor() {
  const { id } = useParams();
  const matches = useMatches();
  const teams = useTeams();
  const questions = useQuestions();
  if (matches.isPending || teams.isPending || questions.isPending) return <p>Loading…</p>;
  const err = matches.error ?? teams.error ?? questions.error;
  if (err) return <Banner>{err.message}</Banner>;
  const match = matches.data?.find((m) => m.id === id);
  if (!match)
    return (
      <Banner>
        Match not found. <Link to="/admin/matches">Back to matches</Link>
      </Banner>
    );
  return (
    <Editor
      match={match}
      allMatches={matches.data ?? []}
      teams={teams.data ?? []}
      questions={questions.data ?? []}
      refreshing={matches.isFetching}
    />
  );
}

function Editor({
  match,
  allMatches,
  teams,
  questions,
  refreshing,
}: {
  match: Match;
  allMatches: Match[];
  teams: Team[];
  questions: Question[];
  refreshing: boolean;
}) {
  const save = useSaveMatch();
  const lock = useLockMatch();
  const [newType, setNewType] = useState<RoundType>("connection");
  const [teamError, setTeamError] = useState<string | null>(null);
  const busy = save.isPending || lock.isPending || refreshing;
  const ro = match.locked;
  const disabled = ro || busy;
  const qById = new Map(questions.map((q) => [q.id, q]));
  const otherUsage = usageMap(allMatches.filter((m) => m.id !== match.id));

  function update(next: Partial<Match>) {
    save.mutate({ ...match, ...next });
  }
  function updateRound(i: number, next: Round) {
    update({ rounds: match.rounds.map((r, j) => (j === i ? next : r)) });
  }

  return (
    <section>
      <div className="adm-pagehead">
        <h2>{match.name}</h2>
        <div className="adm-row">
          <Link to="/admin/matches">← All matches</Link>
          <button
            type="button"
            className={`adm-btn${ro ? " adm-btn-primary" : ""}`}
            disabled={busy}
            onClick={() => lock.mutate({ id: match.id, locked: !ro })}
          >
            {ro ? "🔒 Unlock to edit" : "Lock match"}
          </button>
        </div>
      </div>
      {ro && (
        <Banner kind="warn">This match is locked while it runs. Unlock it to make changes.</Banner>
      )}
      <Banner>{(save.error ?? lock.error)?.message}</Banner>

      <div className="adm-card adm-form">
        <div className="adm-field">
          <label htmlFor="match-name">Name</label>
          <CommitInput
            id="match-name"
            value={match.name}
            disabled={disabled}
            onCommit={(name) => name.trim() && update({ name: name.trim() })}
          />
        </div>
        <div className="adm-field">
          <span className="adm-label">Teams (1–6)</span>
          <TeamPicker
            teams={teams}
            value={match.teamIds}
            disabled={disabled}
            onChange={(teamIds) => {
              if (teamIds.length === 0) {
                setTeamError("A match needs at least one team.");
                return;
              }
              setTeamError(null);
              update({ teamIds });
            }}
          />
          {teamError && <div className="adm-error">{teamError}</div>}
        </div>
      </div>

      <h3>Rounds</h3>
      {match.rounds.length === 0 && <p className="adm-muted">No rounds yet. Add one below.</p>}
      {match.rounds.map((r, i) => (
        <RoundCard
          key={r.id}
          round={r}
          index={i}
          count={match.rounds.length}
          teamCount={match.teamIds.length}
          disabled={disabled}
          questions={questions}
          qById={qById}
          otherUsage={otherUsage}
          match={match}
          onChange={(next) => updateRound(i, next)}
          onMove={(d) => update({ rounds: move(match.rounds, i, d) })}
          onRemove={() => {
            if (
              !r.questionIds.length ||
              confirm(`Remove round ${i + 1}? Its questions stay in the bank.`)
            )
              update({ rounds: match.rounds.filter((_, j) => j !== i) });
          }}
        />
      ))}
      {!ro && (
        <div className="adm-card adm-row">
          <select
            className="adm-input"
            aria-label="Round type"
            value={newType}
            onChange={(e) => setNewType(e.target.value as RoundType)}
          >
            {ROUND_TYPES.map((t) => (
              <option key={t} value={t}>
                {ROUND_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            disabled={disabled}
            onClick={() =>
              // The server assigns the round id.
              update({
                rounds: [...match.rounds, { id: "", type: newType, title: "", questionIds: [] }],
              })
            }
          >
            + Add round
          </button>
        </div>
      )}
    </section>
  );
}

/** Text input that reports its value on blur or Enter. */
function CommitInput({
  value,
  onCommit,
  ...rest
}: {
  value: string;
  onCommit: (v: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [local, setLocal] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setLocal(value);
  }
  return (
    <input
      {...rest}
      className="adm-input"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

function TimerControl({
  round,
  disabled,
  onChange,
}: {
  round: Round;
  disabled: boolean;
  onChange: (timerSec: number | null | undefined) => void;
}) {
  const def = DEFAULT_TIMER_SEC[round.type];
  const mode =
    round.timerSec === undefined ? "default" : round.timerSec === null ? "none" : "custom";
  return (
    <div className="adm-row adm-nowrap">
      <select
        className="adm-input"
        aria-label="Timer"
        value={mode}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          onChange(
            v === "default" ? undefined : v === "none" ? null : (round.timerSec ?? def ?? 60),
          );
        }}
      >
        <option value="default">Timer: default ({def === null ? "none" : `${def}s`})</option>
        <option value="none">Timer: none</option>
        <option value="custom">Timer: custom</option>
      </select>
      {mode === "custom" && (
        <>
          <CommitInput
            aria-label="Timer seconds"
            value={String(round.timerSec)}
            disabled={disabled}
            onCommit={(v) => {
              const n = Math.round(Number(v));
              if (Number.isFinite(n) && n > 0) onChange(n);
            }}
          />
          <span className="adm-muted">s</span>
        </>
      )}
    </div>
  );
}

function slotLabel(type: RoundType, i: number, teamCount: number): string {
  if (type === "connection" || type === "sequence") {
    const g = GLYPHS[i];
    return g ? `${g.symbol} ${g.name}` : `#${i + 1}`;
  }
  if (type === "wall") return `Wall ${i + 1}${i < teamCount ? "" : " (spare)"}`;
  if (type === "board") return `Column ${i + 1}`;
  return `${i + 1}.`;
}

function RoundCard({
  round,
  index,
  count,
  teamCount,
  disabled,
  questions,
  qById,
  otherUsage,
  match,
  onChange,
  onMove,
  onRemove,
}: {
  round: Round;
  index: number;
  count: number;
  teamCount: number;
  disabled: boolean;
  questions: Question[];
  qById: Map<string, Question>;
  otherUsage: Map<string, { id: string; name: string }[]>;
  match: Match;
  onChange: (r: Round) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const max = ROUND_MAX[round.type];
  const ids = round.questionIds;
  const full = max !== null && ids.length >= max;
  const glyphs = round.type === "connection" || round.type === "sequence";

  function inOtherRound(qid: string): number | null {
    const j = match.rounds.findIndex((r, k) => k !== index && r.questionIds.includes(qid));
    return j === -1 ? null : j + 1;
  }
  function usageNote(qid: string): string {
    const notes: string[] = [];
    const other = inOtherRound(qid);
    if (other !== null) notes.push(`round ${other} here`);
    for (const m of otherUsage.get(qid) ?? []) notes.push(m.name);
    return notes.length ? `also in ${notes.join(", ")}` : "";
  }

  return (
    <div className="adm-card adm-round">
      <div className="adm-round-head">
        <span className="adm-round-num display-font">{index + 1}</span>
        <strong>{ROUND_TYPE_LABELS[round.type]}</strong>
        <CommitInput
          aria-label="Round title"
          placeholder={`Title (default: ${ROUND_TYPE_LABELS[round.type]})`}
          value={round.title}
          disabled={disabled}
          onCommit={(title) => onChange({ ...round, title: title.trim() })}
        />
        <TimerControl
          round={round}
          disabled={disabled}
          onChange={(timerSec) => {
            const { timerSec: _t, ...rest } = round;
            onChange(timerSec === undefined ? rest : { ...rest, timerSec });
          }}
        />
        <div className="adm-row adm-nowrap">
          <button
            type="button"
            className="adm-btn adm-btn-small"
            aria-label="Move round up"
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-small"
            aria-label="Move round down"
            disabled={disabled || index === count - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-small adm-btn-danger"
            disabled={disabled}
            onClick={onRemove}
          >
            Remove round
          </button>
        </div>
      </div>
      {round.type === "board" && (
        <div className="adm-row">
          <label className="adm-label" htmlFor={`neg-${round.id || index}`}>
            Negative marking
          </label>
          <select
            id={`neg-${round.id || index}`}
            className="adm-input"
            value={round.negative ?? "steals"}
            disabled={disabled}
            onChange={(e) => onChange({ ...round, negative: e.target.value as NegativeMarking })}
          >
            {NEGATIVE_MARKING.map((n) => (
              <option key={n} value={n}>
                {NEGATIVE_LABELS[n]}
              </option>
            ))}
          </select>
          <span className="adm-hint">
            Each column is one board category. Usually 4 columns, up to 6.
          </span>
        </div>
      )}
      {round.type === "wall" && (
        <div className="adm-hint">
          Usually one wall per team ({teamCount} team{teamCount === 1 ? "" : "s"}), up to 6.
        </div>
      )}
      <ol className="adm-slots">
        {ids.map((qid, i) => {
          const q = qById.get(qid);
          const note = usageNote(qid);
          return (
            <li key={qid} className="adm-slot">
              <span className="adm-slot-label">{slotLabel(round.type, i, teamCount)}</span>
              {q ? (
                <>
                  {glyphs && q.type !== exactType(round.type) && <TypeBadge type={q.type} />}
                  <Link className="adm-grow adm-qlink" to={`/admin/questions/${q.id}`}>
                    {questionSummary(q)}
                  </Link>
                </>
              ) : (
                <span className="adm-grow adm-error">Missing question {qid}</span>
              )}
              {note && <span className="adm-used">{note}</span>}
              <div className="adm-row adm-nowrap">
                <button
                  type="button"
                  className="adm-btn adm-btn-small"
                  aria-label="Move up"
                  disabled={disabled || i === 0}
                  onClick={() => onChange({ ...round, questionIds: move(ids, i, -1) })}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn-small"
                  aria-label="Move down"
                  disabled={disabled || i === ids.length - 1}
                  onClick={() => onChange({ ...round, questionIds: move(ids, i, 1) })}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn-small adm-btn-ghost"
                  disabled={disabled}
                  onClick={() => onChange({ ...round, questionIds: ids.filter((_, j) => j !== i) })}
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
        {glyphs &&
          GLYPHS.slice(ids.length + 1).map((g) => (
            <li key={g.id} className="adm-slot adm-slot-empty">
              <span className="adm-slot-label">
                {g.symbol} {g.name}
              </span>
              <span className="adm-muted">empty</span>
            </li>
          ))}
      </ol>
      {!full && !match.locked && (
        <QuestionPicker
          label={
            glyphs || round.type === "board"
              ? `Add to ${slotLabel(round.type, ids.length, teamCount)}`
              : "Add question"
          }
          round={round}
          questions={questions}
          disabled={disabled}
          usageNote={usageNote}
          onPick={(qid) => onChange({ ...round, questionIds: [...ids, qid] })}
        />
      )}
      {full && <div className="adm-hint">All {max} slots filled.</div>}
    </div>
  );
}

function QuestionPicker({
  label,
  round,
  questions,
  disabled,
  usageNote,
  onPick,
}: {
  label: string;
  round: Round;
  questions: Question[];
  disabled: boolean;
  usageNote: (qid: string) => string;
  onPick: (qid: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [choice, setChoice] = useState("");
  const needle = filter.trim().toLowerCase();
  const exact = exactType(round.type);
  const options = questions
    .filter((q) => eligible(round.type, q) && !round.questionIds.includes(q.id))
    .filter((q) => !needle || questionSummary(q).toLowerCase().includes(needle))
    // Exact type first (sequence questions for a sequence round), then unused before used.
    .map((q) => ({ q, note: usageNote(q.id) }))
    .sort(
      (a, b) =>
        Number(b.q.type === exact) - Number(a.q.type === exact) ||
        Number(!!a.note) - Number(!!b.note),
    );
  const wanted = QUESTION_TYPE_FOR_ROUND[round.type];
  return (
    <div className="adm-picker adm-row">
      <span className="adm-label">{label}</span>
      <input
        className="adm-input"
        type="search"
        placeholder="Filter…"
        aria-label="Filter questions"
        value={filter}
        disabled={disabled}
        onChange={(e) => setFilter(e.target.value)}
      />
      <select
        className="adm-input adm-grow"
        aria-label="Question"
        value={choice}
        disabled={disabled}
        onChange={(e) => setChoice(e.target.value)}
      >
        <option value="">
          {options.length ? `Choose a question (${options.length})…` : "No matching questions"}
        </option>
        {options.map(({ q, note }) => (
          <option key={q.id} value={q.id}>
            {q.type !== exact ? `[${q.type}] ` : ""}
            {questionSummary(q).slice(0, 120)}
            {note ? ` — ${note}` : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="adm-btn adm-btn-primary adm-btn-small"
        disabled={disabled || !choice}
        onClick={() => {
          onPick(choice);
          setChoice("");
        }}
      >
        Add
      </button>
      <Link
        className="adm-small"
        to={`/admin/questions/new/${round.type === "sequence" ? "sequence" : wanted}`}
      >
        New…
      </Link>
    </div>
  );
}
