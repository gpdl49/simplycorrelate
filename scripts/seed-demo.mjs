#!/usr/bin/env node
// Imports fixtures/demo-quiz.json (DEMO content) into a running server, REPLACING all content
// unless MODE=merge (add/update by id, keep everything else).
// Usage: pnpm seed:demo   Env: URL (default http://localhost:8080), FILE (default the demo fixture),
//   HOST_PIN (AUTH_MODE=pin: logs in first), COOKIE (sent as-is, e.g. an oauth2-proxy session).
import { readFileSync } from "node:fs";

const url = (process.env.URL ?? "http://localhost:8080").replace(/\/$/, "");
const file = process.env.FILE ?? new URL("../fixtures/demo-quiz.json", import.meta.url);
const body = readFileSync(file, "utf8");
const headers = { "content-type": "application/json" };
if (process.env.COOKIE) headers.cookie = process.env.COOKIE;

if (process.env.HOST_PIN) {
  const r = await fetch(`${url}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin: process.env.HOST_PIN }),
  });
  if (!r.ok) {
    console.error(`PIN login failed: ${r.status} ${await r.text()}`);
    process.exit(1);
  }
  headers.cookie = r.headers.get("set-cookie")?.split(";")[0] ?? "";
}

const mode = process.env.MODE === "merge" ? "?mode=merge" : "";
const r = await fetch(`${url}/api/admin/import${mode}`, { method: "POST", headers, body });
if (!r.ok) {
  console.error(`Import failed: ${r.status} ${await r.text()}`);
  process.exit(1);
}
const q = await r.json();
console.log(
  `Imported into ${url}: ${q.teams} teams, ${q.questions} questions, ${q.matches} matches, ${q.media} media files.`,
);
