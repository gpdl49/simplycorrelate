#!/usr/bin/env node
// Smoke test against a running server: `node scripts/smoke.mjs <pin|proxy|none>`.
// Env: URL (default http://localhost:8080), HOST_PIN (pin mode), EMAIL (proxy mode, an allowed email).
import WebSocket from "ws";

const mode = process.argv[2] ?? "none";
const URL_ = process.env.URL ?? "http://localhost:8080";
const WS_URL = URL_.replace(/^http/, "ws");
let failures = 0;

function check(name, ok, extra = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? ` (${extra})` : ""}`);
  if (!ok) failures++;
}

async function status(path, init) {
  const r = await fetch(URL_ + path, init);
  return r.status;
}

/** Opens a WS and resolves with the first message, or the close/error. */
function wsFirst(role, headers = {}) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS_URL}/ws?role=${role}`, { headers });
    const done = (v) => {
      ws.terminate();
      resolve(v);
    };
    ws.on("message", (d) => {
      const msg = JSON.parse(String(d));
      if (msg.kind === "error") return; // wait for close
      done({ msg });
    });
    ws.on("close", (code) => done({ closed: code }));
    ws.on("unexpected-response", (_req, res) => done({ http: res.statusCode }));
    ws.on("error", (e) => done({ error: e.message }));
    setTimeout(() => done({ timeout: true }), 3000);
  });
}

/** Host session: send messages and wait for the next view. */
function hostSession(headers) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/ws?role=host`, { headers });
    const waiters = [];
    let last = null;
    ws.on("message", (d) => {
      const msg = JSON.parse(String(d));
      if (msg.kind === "view") last = msg.view;
      const w = waiters.shift();
      if (w) w(msg);
      else if (!last || msg.kind === "view") resolveOnce();
    });
    let resolved = false;
    const api = {
      view: () => last,
      send: (m) =>
        new Promise((res) => {
          waiters.push(res);
          ws.send(JSON.stringify(m));
        }),
      close: () => ws.close(),
    };
    const resolveOnce = () => {
      if (!resolved) {
        resolved = true;
        resolve(api);
      }
    };
    ws.on("error", reject);
  });
}

check("/healthz open", (await status("/healthz")) === 200);

let headers = {};
if (mode === "pin") {
  check("admin 401 without cookie", (await status("/api/admin/teams")) === 401);
  const r = await wsFirst("host");
  check("host WS rejected without cookie", r.closed === 4401, JSON.stringify(r));
  const d = await wsFirst("display");
  check("display WS open", d.msg?.view?.role === "display");
  const bad = await status("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin: "wrong" }),
  });
  check("wrong PIN 401", bad === 401);
  const login = await fetch(`${URL_}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin: process.env.HOST_PIN }),
  });
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  check("PIN login sets cookie", login.status === 200 && cookie.startsWith("sc_host="));
  check(
    "forged cookie rejected",
    (await status("/api/admin/teams", { headers: { cookie: "sc_host=1.abc" } })) === 401,
  );
  headers = { cookie };
} else if (mode === "proxy") {
  check("display 401 without header", (await status("/display")) === 401);
  check("api 401 without header", (await status("/api/me")) === 401);
  const r = await wsFirst("display");
  check("WS rejected without header", r.http === 401, JSON.stringify(r));
  const other = { "x-auth-request-email": "intruder@example.com" };
  check(
    "email outside ALLOWED_EMAILS rejected",
    (await status("/display", { headers: other })) === 401,
  );
  headers = { "x-auth-request-email": process.env.EMAIL ?? "host@example.com" };
  check("display 200 with header", (await status("/display", { headers })) === 200);
  const me = await (await fetch(`${URL_}/api/me`, { headers })).json();
  check("/api/me reports user", me.user === headers["x-auth-request-email"].toLowerCase());
}

check("admin 200 when authorised", (await status("/api/admin/teams", { headers })) === 200);

// Live game: start a match, play an action, undo it.
const matches = await (await fetch(`${URL_}/api/admin/matches`, { headers })).json();
if (!matches.length) {
  console.log("(no matches; run `pnpm seed:demo` to test the live game)");
} else {
  const host = await hostSession(headers);
  check("host WS gets host view", host.view()?.role === "host");
  let m = await host.send({
    kind: "action",
    action: { type: "startMatch", matchId: matches[0].id },
  });
  check("startMatch", m.view?.match?.id === matches[0].id, m.message);
  const team = m.view.match && Object.keys(m.view.scores)[0];
  m = await host.send({ kind: "action", action: { type: "adjustScore", teamId: team, delta: 5 } });
  check("adjustScore", m.view?.scores[team] === 5);
  m = await host.send({ kind: "undo" });
  check("undo", m.view?.scores[team] === 0);
  m = await host.send({ kind: "action", action: { type: "adjustScore", teamId: team, delta: 3 } });
  m = await host.send({ kind: "action", action: { type: "pickSlot", slot: 0 } });
  check("invalid action → error message", m.kind === "error", m.message);
  m = await host.send({ kind: "ping" });
  check("ping → pong", m.kind === "pong");
  host.close();
  const d = await wsFirst("display", headers);
  check("display sees live state", d.msg?.view?.scores?.[team] === 3);
}

console.log(failures ? `${failures} check(s) failed` : "all checks passed");
process.exit(failures ? 1 : 0);
