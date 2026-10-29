import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router";
import { api } from "../lib/api";
import "./admin.css";
import { ImportExportPage } from "./ImportExportPage";
import { MatchEditor } from "./MatchEditor";
import { MatchesPage } from "./MatchesPage";
import { QuestionEditPage } from "./QuestionEditPage";
import { QuestionsPage } from "./QuestionsPage";
import { HttpError, keys, useMe } from "./queries";
import { TeamsPage } from "./TeamsPage";
import { Banner } from "./ui";

export function AdminApp() {
  const me = useMe();
  if (me.isPending) return <div className="adm-center">Loading…</div>;
  if (me.isError) {
    const unauth = me.error instanceof HttpError && me.error.status === 401;
    return (
      <div className="adm-center">
        <div className="adm-card adm-narrow">
          <h1 className="adm-brand-title">simplycorrelate</h1>
          <Banner>
            {unauth ? "Not authorised." : `Could not reach the server: ${me.error.message}`}
          </Banner>
          {!unauth && (
            <button type="button" className="adm-btn" onClick={() => me.refetch()}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }
  if (!me.data.host) {
    return me.data.mode === "pin" ? (
      <PinLogin />
    ) : (
      <div className="adm-center">
        <div className="adm-card adm-narrow">
          <h1 className="adm-brand-title">simplycorrelate</h1>
          <Banner>Not authorised.</Banner>
        </div>
      </div>
    );
  }
  return (
    <div className="adm">
      <header className="adm-header">
        <div className="adm-brand">
          <span className="adm-logo">exun</span>
          <span className="adm-brand-title">simplycorrelate</span>
        </div>
        <nav className="adm-nav">
          <NavLink to="/admin/teams">Teams</NavLink>
          <NavLink to="/admin/questions">Questions</NavLink>
          <NavLink to="/admin/matches">Matches</NavLink>
          <NavLink to="/admin/data">Import/Export</NavLink>
        </nav>
        <div className="adm-nav adm-nav-ext">
          <a href="/display" target="_blank" rel="noreferrer">
            Display ↗
          </a>
          <a href="/host" target="_blank" rel="noreferrer">
            Host ↗
          </a>
          {me.data.user && me.data.user !== "local" && (
            <span className="adm-user">{me.data.user}</span>
          )}
        </div>
      </header>
      <main className="adm-main">
        <Routes>
          <Route index element={<Navigate to="/admin/questions" replace />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="questions" element={<QuestionsPage />} />
          <Route path="questions/new/:type" element={<QuestionEditPage />} />
          <Route path="questions/:id" element={<QuestionEditPage />} />
          <Route path="matches" element={<MatchesPage />} />
          <Route path="matches/:id" element={<MatchEditor />} />
          <Route path="data" element={<ImportExportPage />} />
          <Route path="*" element={<Navigate to="/admin/questions" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function PinLogin() {
  const qc = useQueryClient();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/login", { method: "POST", json: { pin } });
      await qc.invalidateQueries({ queryKey: keys.me });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="adm-center">
      <form className="adm-card adm-narrow" onSubmit={submit}>
        <h1 className="adm-brand-title">simplycorrelate</h1>
        <p>Enter the host PIN to manage the quiz.</p>
        <input
          className="adm-input"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          // biome-ignore lint/a11y/noAutofocus: single-field login screen
          autoFocus
        />
        <Banner>{error}</Banner>
        <button type="submit" className="adm-btn adm-btn-primary" disabled={busy || !pin}>
          {busy ? "Checking…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
