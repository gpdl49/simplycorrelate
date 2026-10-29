import { type FormEvent, useEffect, useState } from "react";
import { api, type Me } from "../lib/api";
import { Btn } from "./ui";

/** Shown when the host WebSocket is refused. PIN form in pin mode; a login link in proxy mode. */
export function Login() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Me>("/me")
      .then(setMe)
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/login", { method: "POST", json: { pin } });
      location.reload();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="h-login">
      <img src="/exun-logo.png" alt="Exun" className="h-login-logo" />
      <h2>Host remote</h2>
      {loadError && <p className="h-login-error">Can't reach the server: {loadError}</p>}
      {me?.mode === "pin" && (
        <form onSubmit={submit} className="h-login-form">
          <label htmlFor="pin">Host PIN</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            // biome-ignore lint/a11y/noAutofocus: single-field login screen
            autoFocus
          />
          {error && <p className="h-login-error">{error}</p>}
          <Btn type="submit" tone="primary" big disabled={busy || !pin}>
            {busy ? "Checking…" : "Unlock"}
          </Btn>
        </form>
      )}
      {me?.mode === "proxy" && (
        <>
          <p>
            You're not signed in as a host{me.user ? ` (signed in as ${me.user})` : ""}. Log in with
            your Exun account, then come back here.
          </p>
          <a
            className="h-btn h-primary h-big"
            href={`/oauth2/start?rd=${encodeURIComponent("/host")}`}
          >
            Log in
          </a>
          <Btn big onClick={() => location.reload()}>
            I've logged in — retry
          </Btn>
        </>
      )}
      {me?.mode === "none" && (
        <>
          <p>The server refused the host connection.</p>
          <Btn big onClick={() => location.reload()}>
            Retry
          </Btn>
        </>
      )}
    </div>
  );
}
