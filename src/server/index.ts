import { readFileSync } from "node:fs";
import path from "node:path";
import { serve, upgradeWebSocket } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { WebSocketServer } from "ws";
import { GameError, HostMessageSchema } from "../shared/game";
import type { Role } from "../shared/view";
import { api } from "./api";
import { requireViewer, whoami } from "./auth";
import { config } from "./config";
import { hub, type ServerMessage } from "./hub";
import { seedIfEmpty } from "./store";

seedIfEmpty();

const app = new Hono();

// Health check is mounted before auth so kubelet probes (which bypass the proxy) work.
app.get("/healthz", (c) => c.json({ ok: true }));

app.use("*", async (c, next) => {
  if (c.req.path === "/healthz") return next();
  return requireViewer(c, next);
});

app.route("/api", api);

app.use("/media/*", serveStatic({ root: config.dataDir }));

app.get(
  "/ws",
  upgradeWebSocket((c) => {
    const wantHost = c.req.query("role") === "host";
    const { host } = whoami(c);
    const role: Role = wantHost && host ? "host" : "display";
    let client: ReturnType<typeof hub.add> | null = null;
    return {
      onOpen(_e, ws) {
        if (wantHost && !host) {
          ws.send(
            JSON.stringify({ kind: "error", message: "unauthorised" } satisfies ServerMessage),
          );
          ws.close(4401, "unauthorised");
          return;
        }
        client = hub.add(ws, role);
      },
      onMessage(e, ws) {
        let msg: ReturnType<typeof HostMessageSchema.parse>;
        try {
          msg = HostMessageSchema.parse(JSON.parse(String(e.data)));
        } catch {
          ws.send(
            JSON.stringify({ kind: "error", message: "Bad message" } satisfies ServerMessage),
          );
          return;
        }
        if (msg.kind === "ping") {
          ws.send(JSON.stringify({ kind: "pong", serverNow: Date.now() } satisfies ServerMessage));
          return;
        }
        if (role !== "host") return;
        try {
          if (msg.kind === "undo") hub.undoLast();
          else hub.dispatch(msg.action);
        } catch (err) {
          const message = err instanceof GameError ? err.message : "Server error";
          if (!(err instanceof GameError)) console.error(err);
          ws.send(JSON.stringify({ kind: "error", message } satisfies ServerMessage));
        }
      },
      onClose() {
        if (client) hub.remove(client);
      },
    };
  }),
);

// Built SPA with client-side routing fallback.
app.use("/*", serveStatic({ root: path.relative(process.cwd(), config.webDir) }));
let indexHtml: string | null = null;
app.get("*", (c) => {
  try {
    indexHtml ??= readFileSync(path.join(config.webDir, "index.html"), "utf8");
    return c.html(indexHtml);
  } catch {
    return c.text("Web build not found; run `pnpm build` or use the Vite dev server.", 404);
  }
});

const wss = new WebSocketServer({ noServer: true });
serve(
  { fetch: app.fetch, port: config.port, hostname: config.host, websocket: { server: wss } },
  (info) => {
    console.log(
      `simplycorrelate listening on http://${config.host}:${info.port} (auth: ${config.authMode})`,
    );
  },
);
