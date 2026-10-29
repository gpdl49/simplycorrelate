import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config";

mkdirSync(config.dataDir, { recursive: true });
mkdirSync(path.join(config.dataDir, "media"), { recursive: true });

export const db = new DatabaseSync(path.join(config.dataDir, "quiz.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, sort INTEGER NOT NULL, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, sort INTEGER NOT NULL, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

export function kvGet<T>(key: string): T | undefined {
  const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row ? (JSON.parse(row.value) as T) : undefined;
}

export function kvSet(key: string, value: unknown): void {
  db.prepare(
    "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, JSON.stringify(value));
}

export function tx<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
