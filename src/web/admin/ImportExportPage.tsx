import { useState } from "react";
import { type QuizExport, QuizExportSchema } from "../../shared/content";
import { useImport } from "./queries";
import { Banner } from "./ui";

export function ImportExportPage() {
  const imp = useImport();
  const [pending, setPending] = useState<{ name: string; data: QuizExport } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function pick(file: File) {
    setError(null);
    setDone(null);
    setPending(null);
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
          Media files are referenced by URL and live in the data directory&rsquo;s{" "}
          <code>media/</code> folder; copy that folder too.
        </p>
      </div>
      <div className="adm-card adm-form">
        <h3>Import</h3>
        <Banner kind="warn">Importing replaces all teams, questions and matches.</Banner>
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
        {pending && (
          <div className="adm-confirm">
            <p>
              <strong>{pending.name}</strong> has {pending.data.teams.length} teams,{" "}
              {pending.data.questions.length} questions and {pending.data.matches.length} matches.
              Replace everything currently stored?
            </p>
            <div className="adm-row">
              <button
                type="button"
                className="adm-btn adm-btn-danger"
                disabled={imp.isPending}
                onClick={() =>
                  imp.mutate(pending.data, {
                    onSuccess: () => {
                      setDone(`Imported ${pending.name}.`);
                      setPending(null);
                    },
                  })
                }
              >
                {imp.isPending ? "Importing…" : "Replace everything"}
              </button>
              <button type="button" className="adm-btn" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        <Banner>{imp.error?.message}</Banner>
        <Banner kind="ok">{done}</Banner>
      </div>
    </section>
  );
}
