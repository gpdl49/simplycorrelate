import { Link, useSearchParams } from "react-router";
import type { Question } from "../../shared/content";
import { usageMap, useDeleteQuestion, useMatches, useQuestions } from "./queries";
import { Banner, questionSummary, TYPE_LABELS, TypeBadge } from "./ui";

const TYPES = Object.keys(TYPE_LABELS) as Question["type"][];

/** All searchable text in a question, lowercased. */
function haystack(q: Question): string {
  const parts: string[] = [q.label, q.id];
  switch (q.type) {
    case "standard":
      parts.push(q.prompt, q.answer);
      break;
    case "connection":
    case "sequence":
      parts.push(q.connection, q.explanation, ...q.clues.map((c) => c.text));
      break;
    case "wall":
      for (const g of q.groups) parts.push(g.connection, ...g.clues);
      break;
    case "vowels":
      parts.push(q.category, ...q.clues.map((c) => c.answer));
      break;
  }
  return parts.join(" ").toLowerCase();
}

export function QuestionsPage() {
  const questions = useQuestions();
  const matches = useMatches();
  const del = useDeleteQuestion();
  const [params, setParams] = useSearchParams();
  const type = params.get("type") ?? "";
  const search = params.get("q") ?? "";
  const usage = usageMap(matches.data);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  if (questions.isPending) return <p>Loading questions…</p>;
  if (questions.isError) return <Banner>{questions.error.message}</Banner>;

  const needle = search.trim().toLowerCase();
  const list = questions.data.filter(
    (q) => (!type || q.type === type) && (!needle || haystack(q).includes(needle)),
  );
  const counts = new Map<string, number>();
  for (const q of questions.data) counts.set(q.type, (counts.get(q.type) ?? 0) + 1);

  return (
    <section>
      <div className="adm-pagehead">
        <h2>Question bank</h2>
        <div className="adm-row">
          {TYPES.map((t) => (
            <Link key={t} className="adm-btn adm-btn-small" to={`/admin/questions/new/${t}`}>
              + {TYPE_LABELS[t]}
            </Link>
          ))}
        </div>
      </div>
      <div className="adm-card adm-row">
        <select
          className="adm-input"
          aria-label="Filter by type"
          value={type}
          onChange={(e) => setParam("type", e.target.value)}
        >
          <option value="">All types ({questions.data.length})</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]} ({counts.get(t) ?? 0})
            </option>
          ))}
        </select>
        <input
          className="adm-input adm-grow"
          type="search"
          placeholder="Search text, answers, labels…"
          value={search}
          onChange={(e) => setParam("q", e.target.value)}
        />
      </div>
      <Banner>{del.error?.message}</Banner>
      <ul className="adm-list">
        {list.map((q) => {
          const used = usage.get(q.id) ?? [];
          return (
            <li key={q.id} className="adm-list-item">
              <TypeBadge type={q.type} />
              <Link className="adm-grow adm-qlink" to={`/admin/questions/${q.id}`}>
                {questionSummary(q)}
              </Link>
              {used.length > 0 && (
                <span className="adm-used" title="Used in these matches">
                  {used.map((m) => m.name).join(", ")}
                </span>
              )}
              <button
                type="button"
                className="adm-btn adm-btn-small adm-btn-danger"
                disabled={del.isPending || used.length > 0}
                title={used.length ? "Remove it from its matches before deleting" : undefined}
                onClick={() => {
                  if (confirm("Delete this question?")) del.mutate(q.id);
                }}
              >
                Delete
              </button>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="adm-empty">
            {questions.data.length ? "No questions match the filter." : "No questions yet."}
          </li>
        )}
      </ul>
    </section>
  );
}
