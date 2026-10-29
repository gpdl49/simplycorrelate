import { useMemo, useState } from "react";
import {
  type CategoryQuestion,
  type ConnectionQuestion,
  defaultBoardPoints,
  type Question,
  type StandardQuestion,
  type VowelsQuestion,
  type WallQuestion,
} from "../../shared/content";
import { disguise, normaliseAnswer, puzzleFor } from "../../shared/vowels";
import { ErrorText, Field, type Issues, MediaField } from "./ui";

/** Draft = a question whose id is "" until first save. */
export function blankQuestion(type: Question["type"]): Question {
  const base = { id: "", label: "" };
  switch (type) {
    case "standard":
      return { ...base, type, prompt: "", answer: "", points: 1, penalty: 0 };
    case "connection":
    case "sequence":
      return {
        ...base,
        type,
        clues: Array.from({ length: 4 }, () => ({ text: "" })),
        connection: "",
        explanation: "",
      };
    case "wall":
      return {
        ...base,
        type,
        groups: Array.from({ length: 4 }, () => ({ connection: "", clues: ["", "", "", ""] })),
      };
    case "vowels":
      return { ...base, type, category: "", clues: [{ answer: "" }] };
    case "category":
      return {
        ...base,
        type,
        category: "",
        clues: Array.from({ length: 5 }, (_, i) => blankBoardClue(i)),
      };
  }
}

function blankBoardClue(i: number): CategoryQuestion["clues"][number] {
  return { prompt: "", answer: "", points: defaultBoardPoints(i) };
}

/** Extra checks the zod schema can't express. Returns issues keyed like zod paths. */
export function extraIssues(q: Question): Issues {
  const map: Issues = new Map();
  if (q.type === "connection" || q.type === "sequence") {
    q.clues.forEach((c, i) => {
      if (!c.text.trim() && !c.media) map.set(`clues.${i}.text`, "Give the clue text or media");
    });
  }
  return map;
}

interface FormProps<Q extends Question> {
  q: Q;
  set: (q: Q) => void;
  issues: Issues;
}

function intOr(value: string): number {
  return value === "" ? Number.NaN : Number(value);
}

export function StandardForm({ q, set, issues }: FormProps<StandardQuestion>) {
  return (
    <>
      <Field label="Question" error={issues.get("prompt")}>
        {(id) => (
          <textarea
            id={id}
            className="adm-input"
            rows={3}
            value={q.prompt}
            onChange={(e) => set({ ...q, prompt: e.target.value })}
          />
        )}
      </Field>
      <Field label="Answer" error={issues.get("answer")}>
        {(id) => (
          <input
            id={id}
            className="adm-input"
            value={q.answer}
            onChange={(e) => set({ ...q, answer: e.target.value })}
          />
        )}
      </Field>
      <div className="adm-grid-2">
        <Field label="Points" error={issues.get("points")}>
          {(id) => (
            <input
              id={id}
              className="adm-input"
              type="number"
              step={1}
              value={Number.isNaN(q.points) ? "" : q.points}
              onChange={(e) => set({ ...q, points: intOr(e.target.value) })}
            />
          )}
        </Field>
        <Field
          label="Penalty"
          error={issues.get("penalty")}
          hint="Points deducted for a wrong answer; 0 disables negative marking."
        >
          {(id) => (
            <input
              id={id}
              className="adm-input"
              type="number"
              min={0}
              step={1}
              value={Number.isNaN(q.penalty) ? "" : q.penalty}
              onChange={(e) => set({ ...q, penalty: intOr(e.target.value) })}
            />
          )}
        </Field>
      </div>
      <Field label="Image (optional)" error={issues.get("media")}>
        {() => (
          <MediaField
            value={q.media}
            accept="image/*"
            onChange={(media) => {
              const { media: _old, ...rest } = q;
              set(media ? { ...rest, media } : rest);
            }}
          />
        )}
      </Field>
    </>
  );
}

export function ConnectionForm({ q, set, issues }: FormProps<ConnectionQuestion>) {
  const seq = q.type === "sequence";
  return (
    <>
      <div className="adm-field">
        <span className="adm-label">Type</span>
        <div className="adm-seg">
          {(["connection", "sequence"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={q.type === t ? "adm-seg-on" : ""}
              onClick={() => set({ ...q, type: t })}
            >
              {t === "connection" ? "Connection" : "Sequence"}
            </button>
          ))}
        </div>
        <div className="adm-hint">
          {seq
            ? "Sequence: teams see clues 1–3 and must give the fourth. Clue 4 is the answer, revealed afterwards."
            : "Connection: teams see up to four clues and must name what links them."}
        </div>
      </div>
      <div className="adm-clues">
        {q.clues.map((c, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed four slots
            key={i}
            className={`adm-clue${seq && i === 3 ? " adm-clue-answer" : ""}`}
          >
            <Field
              label={seq && i === 3 ? "Clue 4 — the answer" : `Clue ${i + 1}`}
              error={issues.get(`clues.${i}.text`) ?? issues.get(`clues.${i}`)}
            >
              {(id) => (
                <input
                  id={id}
                  className="adm-input"
                  value={c.text}
                  onChange={(e) => {
                    const clues = q.clues.slice();
                    clues[i] = { ...c, text: e.target.value };
                    set({ ...q, clues });
                  }}
                />
              )}
            </Field>
            <MediaField
              value={c.media}
              onChange={(media) => {
                const clues = q.clues.slice();
                const { media: _old, ...rest } = c;
                clues[i] = media ? { ...rest, media } : rest;
                set({ ...q, clues });
              }}
            />
            <ErrorText>{issues.get(`clues.${i}.media.url`)}</ErrorText>
          </div>
        ))}
      </div>
      <ErrorText>{issues.get("clues")}</ErrorText>
      <Field
        label={seq ? "The sequence (what links them)" : "Connection"}
        error={issues.get("connection")}
      >
        {(id) => (
          <input
            id={id}
            className="adm-input"
            value={q.connection}
            onChange={(e) => set({ ...q, connection: e.target.value })}
          />
        )}
      </Field>
      <Field
        label="Explanation (host only)"
        error={issues.get("explanation")}
        hint="Notes on each clue, shown on the host remote."
      >
        {(id) => (
          <textarea
            id={id}
            className="adm-input"
            rows={4}
            value={q.explanation}
            onChange={(e) => set({ ...q, explanation: e.target.value })}
          />
        )}
      </Field>
    </>
  );
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function WallForm({ q, set, issues }: FormProps<WallQuestion>) {
  const [seed, setSeed] = useState(1);
  const dupes = useMemo(() => {
    const seen = new Map<string, number>();
    for (const g of q.groups)
      for (const c of g.clues) if (norm(c)) seen.set(norm(c), (seen.get(norm(c)) ?? 0) + 1);
    return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
  }, [q.groups]);
  const tiles = useMemo(
    () =>
      seededShuffle(
        q.groups.flatMap((g, gi) => g.clues.map((text, ci) => ({ text, gi, key: `${gi}-${ci}` }))),
        seed,
      ),
    [q.groups, seed],
  );

  function setClue(gi: number, ci: number, text: string) {
    const groups = q.groups.map((g, i) =>
      i === gi ? { ...g, clues: g.clues.map((c, j) => (j === ci ? text : c)) } : g,
    );
    set({ ...q, groups });
  }

  return (
    <>
      {dupes.size > 0 && (
        <div className="adm-banner adm-banner-warn">
          Duplicate clue text: {[...dupes].map((d) => `“${d}”`).join(", ")}. Tiles on the wall must
          be distinguishable.
        </div>
      )}
      <div className="adm-wall-groups">
        {q.groups.map((g, gi) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed four groups
          <fieldset key={gi} className={`adm-wall-group adm-wall-g${gi + 1}`}>
            <legend>Group {gi + 1}</legend>
            <Field label="Connection" error={issues.get(`groups.${gi}.connection`)}>
              {(id) => (
                <input
                  id={id}
                  className="adm-input"
                  value={g.connection}
                  onChange={(e) => {
                    const groups = q.groups.map((x, i) =>
                      i === gi ? { ...x, connection: e.target.value } : x,
                    );
                    set({ ...q, groups });
                  }}
                />
              )}
            </Field>
            {g.clues.map((c, ci) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed four clues
                key={ci}
              >
                <input
                  className={`adm-input${dupes.has(norm(c)) ? " adm-input-warn" : ""}`}
                  aria-label={`Group ${gi + 1} clue ${ci + 1}`}
                  placeholder={`Clue ${ci + 1}`}
                  value={c}
                  onChange={(e) => setClue(gi, ci, e.target.value)}
                />
                <ErrorText>{issues.get(`groups.${gi}.clues.${ci}`)}</ErrorText>
              </div>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="adm-field">
        <div className="adm-row">
          <span className="adm-label">Shuffled preview</span>
          <button
            type="button"
            className="adm-btn adm-btn-small"
            onClick={() => setSeed(Math.floor(Math.random() * 2 ** 31) + 1)}
          >
            Reshuffle
          </button>
        </div>
        <div className="adm-wall-preview">
          {tiles.map((t) => (
            <div
              key={t.key}
              className={`adm-wall-tile adm-wall-g${t.gi + 1}${dupes.has(norm(t.text)) ? " adm-wall-dupe" : ""}`}
            >
              {t.text || "—"}
            </div>
          ))}
        </div>
        <div className="adm-hint">
          Colour stripes show the true group (for you only). The game shuffles the wall itself.
        </div>
      </div>
    </>
  );
}

function consonants(s: string): string {
  return normaliseAnswer(s).replace(/[AEIOU ]/g, "");
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31) + 1;
}

/** A new disguise different from the current one, if the answer allows one. */
function reshuffled(answer: string, current: string): string {
  for (let i = 0; i < 20; i++) {
    const p = disguise(answer, randomSeed());
    if (p !== current) return p;
  }
  return current;
}

export function VowelsForm({ q, set, issues }: FormProps<VowelsQuestion>) {
  function setClue(i: number, next: VowelsQuestion["clues"][number]) {
    set({ ...q, clues: q.clues.map((c, j) => (j === i ? next : c)) });
  }
  return (
    <>
      <Field label="Category" error={issues.get("category")}>
        {(id) => (
          <input
            id={id}
            className="adm-input"
            value={q.category}
            onChange={(e) => set({ ...q, category: e.target.value })}
          />
        )}
      </Field>
      <div className="adm-vowels">
        {q.clues.map((c, i) => {
          const shown = puzzleFor(c);
          const stale = !!c.puzzle?.trim() && consonants(c.puzzle) !== consonants(c.answer);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: clues have no ids
            <div key={i} className="adm-vowel">
              <div className="adm-vowel-puzzle display-font">{shown || "—"}</div>
              <Field label={`Answer ${i + 1}`} error={issues.get(`clues.${i}.answer`)}>
                {(id) => (
                  <input
                    id={id}
                    className="adm-input"
                    value={c.answer}
                    onChange={(e) => setClue(i, { ...c, answer: e.target.value })}
                  />
                )}
              </Field>
              <Field
                label="Puzzle override"
                hint={
                  c.puzzle?.trim()
                    ? "Stored puzzle (clear to generate automatically)."
                    : "Empty: generated automatically from the answer."
                }
              >
                {(id) => (
                  <input
                    id={id}
                    className={`adm-input adm-mono${stale ? " adm-input-warn" : ""}`}
                    placeholder={disguise(c.answer)}
                    value={c.puzzle ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase();
                      const { puzzle: _p, ...rest } = c;
                      setClue(i, v ? { ...rest, puzzle: v } : rest);
                    }}
                  />
                )}
              </Field>
              {stale && (
                <div className="adm-banner adm-banner-warn">
                  The override's letters don't match the answer's consonants (
                  {consonants(c.answer) || "—"}).
                </div>
              )}
              <div className="adm-row">
                <button
                  type="button"
                  className="adm-btn adm-btn-small"
                  disabled={!c.answer.trim()}
                  onClick={() => setClue(i, { ...c, puzzle: reshuffled(c.answer, shown) })}
                >
                  Reshuffle spacing
                </button>
                {c.puzzle && (
                  <button
                    type="button"
                    className="adm-btn adm-btn-small adm-btn-ghost"
                    onClick={() => {
                      const { puzzle: _p, ...rest } = c;
                      setClue(i, rest);
                    }}
                  >
                    Use automatic
                  </button>
                )}
                <span className="adm-grow" />
                <button
                  type="button"
                  className="adm-btn adm-btn-small adm-btn-danger"
                  disabled={q.clues.length <= 1}
                  onClick={() => set({ ...q, clues: q.clues.filter((_, j) => j !== i) })}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <ErrorText>{issues.get("clues")}</ErrorText>
      <button
        type="button"
        className="adm-btn"
        disabled={q.clues.length >= 4}
        onClick={() => set({ ...q, clues: [...q.clues, { answer: "" }] })}
      >
        + Add answer ({q.clues.length}/4)
      </button>
    </>
  );
}

const MAX_BOARD_CLUES = 6;

export function CategoryForm({ q, set, issues }: FormProps<CategoryQuestion>) {
  type BoardClue = CategoryQuestion["clues"][number];
  function setClue(i: number, next: BoardClue) {
    set({ ...q, clues: q.clues.map((c, j) => (j === i ? next : c)) });
  }
  function moveClue(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= q.clues.length) return;
    const clues = q.clues.slice();
    [clues[i], clues[j]] = [clues[j]!, clues[i]!];
    set({ ...q, clues });
  }
  return (
    <>
      <Field
        label="Category"
        error={issues.get("category")}
        hint="Column heading on the board. Clues usually rise in value from top to bottom."
      >
        {(id) => (
          <input
            id={id}
            className="adm-input"
            value={q.category}
            onChange={(e) => set({ ...q, category: e.target.value })}
          />
        )}
      </Field>
      <div className="adm-vowels">
        {q.clues.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: clues have no ids
          <div key={i} className="adm-vowel">
            <Field label={`Clue ${i + 1}`} error={issues.get(`clues.${i}.prompt`)}>
              {(id) => (
                <textarea
                  id={id}
                  className="adm-input"
                  rows={2}
                  value={c.prompt}
                  onChange={(e) => setClue(i, { ...c, prompt: e.target.value })}
                />
              )}
            </Field>
            <div className="adm-board-clue-row">
              <Field label="Answer" error={issues.get(`clues.${i}.answer`)}>
                {(id) => (
                  <input
                    id={id}
                    className="adm-input"
                    value={c.answer}
                    onChange={(e) => setClue(i, { ...c, answer: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Points" error={issues.get(`clues.${i}.points`)}>
                {(id) => (
                  <input
                    id={id}
                    className="adm-input"
                    type="number"
                    min={1}
                    step={1}
                    value={Number.isNaN(c.points) ? "" : c.points}
                    onChange={(e) => setClue(i, { ...c, points: intOr(e.target.value) })}
                  />
                )}
              </Field>
            </div>
            <MediaField
              value={c.media}
              onChange={(media) => {
                const { media: _old, ...rest } = c;
                setClue(i, media ? { ...rest, media } : rest);
              }}
            />
            <ErrorText>{issues.get(`clues.${i}.media.url`)}</ErrorText>
            <div className="adm-row">
              <button
                type="button"
                className="adm-btn adm-btn-small"
                aria-label={`Move clue ${i + 1} up`}
                disabled={i === 0}
                onClick={() => moveClue(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-small"
                aria-label={`Move clue ${i + 1} down`}
                disabled={i === q.clues.length - 1}
                onClick={() => moveClue(i, 1)}
              >
                ↓
              </button>
              <span className="adm-grow" />
              <button
                type="button"
                className="adm-btn adm-btn-small adm-btn-danger"
                disabled={q.clues.length <= 1}
                onClick={() => set({ ...q, clues: q.clues.filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <ErrorText>{issues.get("clues")}</ErrorText>
      <button
        type="button"
        className="adm-btn"
        disabled={q.clues.length >= MAX_BOARD_CLUES}
        onClick={() => set({ ...q, clues: [...q.clues, blankBoardClue(q.clues.length)] })}
      >
        + Add clue ({q.clues.length}/{MAX_BOARD_CLUES})
      </button>
    </>
  );
}
