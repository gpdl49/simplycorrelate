import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { type Question, QuestionSchema } from "../../shared/content";
import {
  blankQuestion,
  ConnectionForm,
  extraIssues,
  StandardForm,
  VowelsForm,
  WallForm,
} from "./QuestionForms";
import { usageMap, useMatches, useQuestions, useSaveQuestion } from "./queries";
import { Banner, Field, issuesOf, TYPE_LABELS } from "./ui";

const TYPES = Object.keys(TYPE_LABELS) as Question["type"][];

export function QuestionEditPage() {
  const { id, type } = useParams();
  const questions = useQuestions();
  if (id) {
    if (questions.isPending) return <p>Loading…</p>;
    if (questions.isError) return <Banner>{questions.error.message}</Banner>;
    const q = questions.data.find((x) => x.id === id);
    if (!q)
      return (
        <Banner>
          Question not found. <Link to="/admin/questions">Back to the bank</Link>
        </Banner>
      );
    return <QuestionEditor key={q.id} initial={q} />;
  }
  const t = TYPES.find((x) => x === type);
  if (!t) return <Banner>Unknown question type “{type}”.</Banner>;
  return <QuestionEditor key={`new-${t}`} initial={blankQuestion(t)} />;
}

function QuestionEditor({ initial }: { initial: Question }) {
  const navigate = useNavigate();
  const save = useSaveQuestion();
  const matches = useMatches();
  const [draft, setDraft] = useState<Question>(initial);
  const [saved, setSaved] = useState<Question>(initial);
  const [attempted, setAttempted] = useState(false);
  const location = useLocation();
  const [flash, setFlash] = useState<string | null>(
    (location.state as { flash?: string } | null)?.flash ?? null,
  );
  const isNew = !draft.id;
  const used = usageMap(matches.data).get(draft.id) ?? [];

  const parsed = QuestionSchema.safeParse({ ...draft, id: draft.id || "new" });
  const issues = issuesOf(parsed.success ? undefined : parsed.error);
  for (const [k, v] of extraIssues(draft)) if (!issues.has(k)) issues.set(k, v);
  const shown = attempted ? issues : new Map<string, string>();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function set(q: Question) {
    setDraft(q);
    setFlash(null);
  }

  function submit(andNew: boolean) {
    setAttempted(true);
    if (!parsed.success || issues.size) return;
    const body = isNew ? { ...parsed.data, id: undefined } : parsed.data;
    save.mutate(body as Question, {
      onSuccess: (q) => {
        setAttempted(false);
        if (andNew) {
          setFlash("Saved. Add the next one.");
          const blank = blankQuestion(q.type);
          setDraft(blank);
          setSaved(blank);
          if (!isNew)
            navigate(`/admin/questions/new/${q.type}`, {
              state: { flash: "Saved. Add the next one." },
            });
        } else {
          setDraft(q);
          setSaved(q);
          setFlash("Saved.");
          if (isNew)
            navigate(`/admin/questions/${q.id}`, { replace: true, state: { flash: "Saved." } });
        }
      },
    });
  }

  const form = (() => {
    const p = { issues: shown };
    switch (draft.type) {
      case "standard":
        return <StandardForm {...p} q={draft} set={set} />;
      case "connection":
      case "sequence":
        return <ConnectionForm {...p} q={draft} set={set} />;
      case "wall":
        return <WallForm {...p} q={draft} set={set} />;
      case "vowels":
        return <VowelsForm {...p} q={draft} set={set} />;
    }
  })();

  return (
    <section>
      <div className="adm-pagehead">
        <h2>
          {isNew ? "New" : "Edit"} {TYPE_LABELS[draft.type].toLowerCase()}
          {draft.type === "vowels" ? " category" : " question"}
        </h2>
        <Link to="/admin/questions">← Back to the bank</Link>
      </div>
      {used.length > 0 && (
        <Banner kind="info">
          Used in {used.map((m) => m.name).join(", ")}. Edits apply there too.
        </Banner>
      )}
      <form
        className="adm-card adm-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        <Field
          label="Label (internal)"
          hint="Optional. Shown only in admin and on the host remote."
          error={shown.get("label")}
        >
          {(id) => (
            <input
              id={id}
              className="adm-input"
              value={draft.label}
              onChange={(e) => set({ ...draft, label: e.target.value })}
            />
          )}
        </Field>
        {form}
        {attempted && issues.size > 0 && (
          <Banner>Fix the {issues.size === 1 ? "error" : `${issues.size} errors`} above.</Banner>
        )}
        <Banner>{save.error?.message}</Banner>
        <Banner kind="ok">{flash}</Banner>
        <div className="adm-row adm-actions">
          <button type="submit" className="adm-btn adm-btn-primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="adm-btn"
            disabled={save.isPending}
            onClick={() => submit(true)}
          >
            Save and add another
          </button>
          {dirty && <span className="adm-muted">Unsaved changes</span>}
        </div>
      </form>
    </section>
  );
}
