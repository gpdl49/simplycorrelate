import { writeFile } from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { ZodError } from "zod";
import { GameError } from "../shared/game";
import { pinLogin, requireHost, whoami } from "./auth";
import { config } from "./config";
import * as store from "./store";

const MEDIA_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};
const MAX_UPLOAD = 25 * 1024 * 1024;

export const api = new Hono();

api.onError((err, c) => {
  if (err instanceof ZodError) return c.json({ error: "Invalid data", issues: err.issues }, 400);
  if (err instanceof store.StoreError || err instanceof GameError)
    return c.json({ error: err.message }, 400);
  console.error(err);
  return c.json({ error: "Internal error" }, 500);
});

api.get("/healthz", (c) => c.json({ ok: true }));

api.get("/me", (c) => c.json(whoami(c)));

api.post("/login", async (c) => {
  const { pin } = await c.req.json<{ pin?: string }>();
  return pinLogin(c, String(pin ?? ""))
    ? c.json({ ok: true })
    : c.json({ error: "Wrong PIN" }, 401);
});

// Everything below is admin, host only.
api.use("/admin/*", requireHost);

api.get("/admin/teams", (c) => c.json(store.listTeams()));
api.put("/admin/teams/:id", async (c) =>
  c.json(store.saveTeam({ ...(await c.req.json()), id: c.req.param("id") })),
);
api.post("/admin/teams", async (c) => c.json(store.saveTeam(await c.req.json())));
api.post("/admin/teams/reorder", async (c) => {
  store.reorderTeams(await c.req.json<string[]>());
  return c.json({ ok: true });
});
api.delete("/admin/teams/:id", (c) => {
  store.deleteTeam(c.req.param("id"));
  return c.json({ ok: true });
});

api.get("/admin/questions", (c) => c.json(store.listQuestions()));
api.post("/admin/questions", async (c) => c.json(store.saveQuestion(await c.req.json())));
api.put("/admin/questions/:id", async (c) =>
  c.json(store.saveQuestion({ ...(await c.req.json()), id: c.req.param("id") })),
);
api.delete("/admin/questions/:id", (c) => {
  store.deleteQuestion(c.req.param("id"));
  return c.json({ ok: true });
});

api.get("/admin/matches", (c) => c.json(store.listMatches()));
api.post("/admin/matches", async (c) => c.json(store.saveMatch(await c.req.json())));
api.put("/admin/matches/:id", async (c) =>
  c.json(store.saveMatch({ ...(await c.req.json()), id: c.req.param("id") })),
);
api.post("/admin/matches/:id/lock", async (c) => {
  const { locked } = await c.req.json<{ locked: boolean }>();
  return c.json(store.setMatchLocked(c.req.param("id"), !!locked));
});
api.delete("/admin/matches/:id", (c) => {
  store.deleteMatch(c.req.param("id"));
  return c.json({ ok: true });
});

api.get("/admin/export", (c) => {
  c.header(
    "Content-Disposition",
    `attachment; filename="quiz-${new Date().toISOString().slice(0, 10)}.json"`,
  );
  return c.json(store.exportQuiz());
});
/** `?mode=merge` adds/updates by id; the default replaces all content. */
api.post("/admin/import", async (c) =>
  c.json(
    store.importQuiz(await c.req.json(), c.req.query("mode") === "merge" ? "merge" : "replace"),
  ),
);

/** Multipart upload with a single `file` field; returns a Media object. */
api.post("/admin/media", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: "No file" }, 400);
  const ext = MEDIA_TYPES[file.type];
  if (!ext) return c.json({ error: `Unsupported type ${file.type}` }, 400);
  if (file.size > MAX_UPLOAD) return c.json({ error: "File too large (25 MB max)" }, 400);
  const name = `${nanoid(12)}.${ext}`;
  await writeFile(path.join(config.dataDir, "media", name), Buffer.from(await file.arrayBuffer()));
  return c.json({
    kind: file.type.startsWith("audio/") ? "audio" : "image",
    url: `/media/${name}`,
  });
});
