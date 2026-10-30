import { useState } from "react";
import { type QuizExport, QuizExportSchema } from "../../shared/content";
import { type ImportResult, useImport, useMatches, useQuestions, useTeams } from "./queries";
import { Banner } from "./ui";

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

function counts(c: { teams: number; questions: number; matches: number; media: number }): string {
  return [
    plural(c.teams, "team"),
    plural(c.questions, "question"),
    plural(c.matches, "match", "matches"),
    plural(c.media, "media file"),
  ].join(", ");
}

/** "3 new, 2 updated" for the ids in an import compared with what's stored. */
function newVsUpdated(incoming: { id: string }[], stored: { id: string }[] | undefined): string {
  if (!incoming.length || !stored) return "";
  const have = new Set(stored.map((x) => x.id));
  const updated = incoming.filter((x) => have.has(x.id)).length;
  return ` (${incoming.length - updated} new, ${updated} updated)`;
}

export function ImportExportPage() {
  const imp = useImport();
  const teams = useTeams();
  const questions = useQuestions();
  const matches = useMatches();
  const [pending, setPending] = useState<{ name: string; data: QuizExport } | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function pick(file: File) {
    setError(null);
    setDone(null);
    setPending(null);
    setConfirmReplace(false);
    imp.reset();
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      setError("That file isn't valid JSON.");
      return;
    }
    const parsed = QuizExportSchema.safeParse(raw);
    if (!parsed.success) {
      const lines = parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
      setError(`Not a valid quiz export:\n${lines.join("\n")}`);
      return;
    }
    setPending({ name: file.name, data: parsed.data });
  }

  function run(mode: ImportResult["mode"]) {
    if (!pending) return;
    const { name, data } = pending;
    imp.mutate(
      { data, mode },
      {
        onSuccess: (r) => {
          setDone(
            `${r.mode === "merge" ? "Merged" : "Replaced everything with"} ${name}: ${counts(r)}.`,
          );
          setPending(null);
          setConfirmReplace(false);
        },
      },
    );
  }

  const d = pending?.data;
  return (
    <section>
      <div className="adm-pagehead">
        <h2>Import / Export</h2>
      </div>
      <div className="adm-card adm-form">
        <h3>Export</h3>
        <p>Download every team, question and match as one JSON file. Do this before the quiz.</p>
        <div className="adm-row">
          <a className="adm-btn adm-btn-primary" href="/api/admin/export" download>
            Download JSON
          </a>
        </div>
        <p className="adm-hint">
          Uploaded images and audio are bundled into the file, so importing it with &ldquo;Replace
          everything&rdquo; restores the backup fully on any server.
        </p>
      </div>
      <div className="adm-card adm-form">
        <h3>Import</h3>
        <p className="adm-hint">
          Choose a quiz JSON file, then either add / update its questions (recommended) or replace
          everything stored.
        </p>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void pick(f);
          }}
        />
        {error && <pre className="adm-banner adm-banner-error adm-pre">{error}</pre>}
        {pending && d && (
          <div className="adm-form">
            <p>
              <strong>{pending.name}</strong> has {plural(d.teams.length, "team")}
              {newVsUpdated(d.teams, teams.data)}, {plural(d.questions.length, "question")}
              {newVsUpdated(d.questions, questions.data)},{" "}
              {plural(d.matches.length, "match", "matches")}
              {newVsUpdated(d.matches, matches.data)} and{" "}
              {plural(Object.keys(d.media ?? {}).length, "bundled media file")}.
            </p>
            <div className="adm-row">
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                disabled={imp.isPending}
                onClick={() => run("merge")}
              >
                {imp.isPending && imp.variables?.mode === "merge"
                  ? "Importing…"
                  : "Add / update questions (merge)"}
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-danger"
                disabled={imp.isPending || confirmReplace}
                onClick={() => setConfirmReplace(true)}
              >
                Replace everything…
              </button>
              <button
                type="button"
                className="adm-btn"
                onClick={() => {
                  setPending(null);
                  setConfirmReplace(false);
                }}
              >
                Cancel
              </button>
            </div>
            <p className="adm-hint">
              Merge (recommended) adds new items and updates ones with the same id; everything else
              is kept.
            </p>
            {confirmReplace && (
              <div className="adm-confirm">
                <Banner kind="warn">
                  Replace deletes every team, question and match currently stored and keeps only
                  what is in {pending.name}.
                </Banner>
                <div className="adm-row">
                  <button
                    type="button"
                    className="adm-btn adm-btn-danger"
                    disabled={imp.isPending}
                    onClick={() => run("replace")}
                  >
                    {imp.isPending && imp.variables?.mode === "replace"
                      ? "Importing…"
                      : "Yes, replace everything"}
                  </button>
                  <button
                    type="button"
                    className="adm-btn"
                    onClick={() => setConfirmReplace(false)}
                  >
                    Keep current content
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <Banner>{imp.error?.message}</Banner>
        <Banner kind="ok">{done}</Banner>
      </div>
    </section>
  );
}
