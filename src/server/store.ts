import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import {
  type Match,
  MatchSchema,
  type Question,
  QuestionSchema,
  type QuizExport,
  QuizExportSchema,
  type Team,
  TeamSchema,
} from "../shared/content";
import type { Content } from "../shared/game";
import { config } from "./config";
import { db, tx } from "./db";

/** Quiz content persisted in SQLite. Every write calls `onChange` so live clients refresh. */

type Listener = () => void;
const listeners = new Set<Listener>();
export function onContentChange(fn: Listener): void {
  listeners.add(fn);
}
function changed(): void {
  cache = null;
  for (const fn of listeners) fn();
}

const DEFAULT_TEAMS: Omit<Team, "id">[] = [
  { name: "Team 1", color: "#2977F5" },
  { name: "Team 2", color: "#E8484E" },
  { name: "Team 3", color: "#1FB58F" },
  { name: "Team 4", color: "#F5A524" },
  { name: "Team 5", color: "#9B5DE5" },
  { name: "Team 6", color: "#EC6FB0" },
];

export function seedIfEmpty(): void {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM teams").get() as { n: number };
  if (n === 0) {
    tx(() => {
      for (const [i, t] of DEFAULT_TEAMS.entries()) saveTeamRow({ id: `team${i + 1}`, ...t }, i);
    });
  }
}

function rows<T>(sql: string): T[] {
  return (db.prepare(sql).all() as { data: string }[]).map((r) => JSON.parse(r.data) as T);
}

export function listTeams(): Team[] {
  return rows<Team>("SELECT data FROM teams ORDER BY sort, id");
}
export function listQuestions(): Question[] {
  return rows<Question>("SELECT data FROM questions ORDER BY updated_at DESC");
}
export function listMatches(): Match[] {
  return rows<Match>("SELECT data FROM matches ORDER BY sort, id");
}

let cache: Content | null = null;
export function getContent(): Content {
  cache ??= {
    teams: new Map(listTeams().map((t) => [t.id, t])),
    questions: new Map(listQuestions().map((q) => [q.id, q])),
    matches: new Map(listMatches().map((m) => [m.id, m])),
  };
  return cache;
}

function saveTeamRow(t: Team, sort: number): void {
  db.prepare(
    "INSERT INTO teams (id, sort, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, sort = excluded.sort",
  ).run(t.id, sort, JSON.stringify(t));
}

function nextSort(table: "teams" | "matches"): number {
  const { s } = db.prepare(`SELECT COALESCE(MAX(sort), -1) + 1 AS s FROM ${table}`).get() as {
    s: number;
  };
  return s;
}

function existingSort(table: "teams" | "matches", id: string): number | undefined {
  const row = db.prepare(`SELECT sort FROM ${table} WHERE id = ?`).get(id) as
    | { sort: number }
    | undefined;
  return row?.sort;
}

export function saveTeam(input: unknown): Team {
  const t = TeamSchema.parse({ id: nanoid(10), ...(input as object) });
  saveTeamRow(t, existingSort("teams", t.id) ?? nextSort("teams"));
  changed();
  return t;
}

export function deleteTeam(id: string): void {
  if (listMatches().some((m) => m.teamIds.includes(id))) {
    throw new StoreError("Team is used in a match; remove it from the match first");
  }
  db.prepare("DELETE FROM teams WHERE id = ?").run(id);
  changed();
}

export function reorderTeams(ids: string[]): void {
  tx(() => {
    for (const [i, id] of ids.entries())
      db.prepare("UPDATE teams SET sort = ? WHERE id = ?").run(i, id);
  });
  changed();
}

export function saveQuestion(input: unknown): Question {
  const q = QuestionSchema.parse({ id: nanoid(10), ...(input as object) });
  db.prepare(
    "INSERT INTO questions (id, type, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET type = excluded.type, data = excluded.data, updated_at = excluded.updated_at",
  ).run(q.id, q.type, JSON.stringify(q), Date.now());
  changed();
  return q;
}

export function deleteQuestion(id: string): void {
  const used = listMatches().filter((m) => m.rounds.some((r) => r.questionIds.includes(id)));
  if (used.length)
    throw new StoreError(`Question is used in: ${used.map((m) => m.name).join(", ")}`);
  db.prepare("DELETE FROM questions WHERE id = ?").run(id);
  changed();
}

export function saveMatch(input: unknown): Match {
  const raw = input as Partial<Match>;
  const m = MatchSchema.parse({
    id: nanoid(10),
    ...raw,
    rounds: (raw.rounds ?? []).map((r) => ({ ...r, id: r.id || nanoid(8) })),
  });
  const prev = getContent().matches.get(m.id);
  if (prev?.locked) throw new StoreError("Match is locked; unlock it to edit");
  // Lock state changes only through setMatchLocked.
  if (prev) m.locked = prev.locked;
  db.prepare(
    "INSERT INTO matches (id, sort, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
  ).run(m.id, existingSort("matches", m.id) ?? nextSort("matches"), JSON.stringify(m));
  changed();
  return m;
}

export function setMatchLocked(id: string, locked: boolean): Match {
  const m = getContent().matches.get(id);
  if (!m) throw new StoreError("Unknown match");
  const next = { ...m, locked };
  db.prepare("UPDATE matches SET data = ? WHERE id = ?").run(JSON.stringify(next), id);
  changed();
  return next;
}

export function deleteMatch(id: string): void {
  if (getContent().matches.get(id)?.locked)
    throw new StoreError("Match is locked; unlock it to delete");
  db.prepare("DELETE FROM matches WHERE id = ?").run(id);
  changed();
}

const MEDIA_FILE = /^[A-Za-z0-9_-]+\.(png|jpe?g|webp|gif|svg|mp3|m4a|aac|ogg|wav)$/;

/** Filenames of uploaded media referenced anywhere in the content. */
function referencedMedia(data: unknown): string[] {
  const names = new Set<string>();
  for (const m of JSON.stringify(data).matchAll(/"\/media\/([^"/]+)"/g)) {
    if (MEDIA_FILE.test(m[1]!)) names.add(m[1]!);
  }
  return [...names];
}

/** Everything, with referenced media bundled in so the file restores on another server. */
export function exportQuiz(): QuizExport {
  const data: QuizExport = {
    version: 1,
    teams: listTeams(),
    questions: listQuestions(),
    matches: listMatches(),
  };
  const media: Record<string, string> = {};
  for (const name of referencedMedia(data)) {
    const file = path.join(config.dataDir, "media", name);
    if (existsSync(file)) media[name] = readFileSync(file).toString("base64");
  }
  if (Object.keys(media).length) data.media = media;
  return data;
}

export interface ImportResult {
  mode: "replace" | "merge";
  teams: number;
  questions: number;
  matches: number;
  media: number;
}

/**
 * replace: wipe all content first (restoring a backup).
 * merge:   add or update by id, keeping everything else (adding a batch of questions).
 */
export function importQuiz(input: unknown, mode: "replace" | "merge" = "replace"): ImportResult {
  const data = QuizExportSchema.parse(input);
  const media = Object.entries(data.media ?? {});
  for (const [name] of media) {
    if (!MEDIA_FILE.test(name)) throw new StoreError(`Bad media filename ${name}`);
  }
  for (const [name, b64] of media) {
    writeFileSync(path.join(config.dataDir, "media", name), Buffer.from(b64, "base64"));
  }
  tx(() => {
    if (mode === "replace") {
      db.exec("DELETE FROM teams; DELETE FROM questions; DELETE FROM matches;");
    }
    const teamBase = mode === "replace" ? 0 : nextSort("teams");
    for (const [i, t] of data.teams.entries()) {
      saveTeamRow(t, existingSort("teams", t.id) ?? teamBase + i);
    }
    const now = Date.now();
    const upsertQ = db.prepare(
      "INSERT INTO questions (id, type, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET type = excluded.type, data = excluded.data, updated_at = excluded.updated_at",
    );
    for (const [i, q] of data.questions.entries()) {
      upsertQ.run(q.id, q.type, JSON.stringify(q), now - i);
    }
    const matchBase = mode === "replace" ? 0 : nextSort("matches");
    const upsertM = db.prepare(
      "INSERT INTO matches (id, sort, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
    );
    for (const [i, m] of data.matches.entries()) {
      upsertM.run(m.id, existingSort("matches", m.id) ?? matchBase + i, JSON.stringify(m));
    }
  });
  changed();
  return {
    mode,
    teams: data.teams.length,
    questions: data.questions.length,
    matches: data.matches.length,
    media: media.length,
  };
}

export class StoreError extends Error {}
