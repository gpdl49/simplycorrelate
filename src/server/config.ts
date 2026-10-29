import { randomBytes } from "node:crypto";
import path from "node:path";

export type AuthMode = "proxy" | "pin" | "none";

const authMode = (process.env.AUTH_MODE ?? "none") as AuthMode;
if (!["proxy", "pin", "none"].includes(authMode)) throw new Error(`Invalid AUTH_MODE ${authMode}`);
if (authMode === "pin" && !process.env.HOST_PIN) throw new Error("AUTH_MODE=pin requires HOST_PIN");

export const config = {
  port: Number(process.env.PORT ?? 8080),
  /** In proxy mode bind to loopback so only the oauth2-proxy sidecar can reach the app. */
  host: process.env.HOST ?? (authMode === "proxy" ? "127.0.0.1" : "0.0.0.0"),
  dataDir: path.resolve(process.env.DATA_DIR ?? "./data"),
  webDir: path.resolve(process.env.WEB_DIR ?? "./dist/web"),
  authMode,
  hostPin: process.env.HOST_PIN ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? randomBytes(32).toString("hex"),
  /** Proxy mode: comma-separated emails allowed in (empty = anyone the proxy lets through). */
  allowedEmails: (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
};
