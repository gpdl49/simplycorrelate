import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { config } from "./config";

/**
 * proxy: oauth2-proxy (Zitadel) sits in front and sets X-Auth-Request-Email; every request needs it.
 * pin:   offline fallback; host routes need a signed cookie obtained with HOST_PIN, display is open.
 * none:  local development; everything open.
 */

const COOKIE = "sc_host";
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7;

function sign(value: string): string {
  return createHmac("sha256", config.sessionSecret).update(value).digest("base64url");
}

function proxyUser(c: Context): string | null {
  const email = (
    c.req.header("x-auth-request-email") ??
    c.req.header("x-forwarded-email") ??
    ""
  ).toLowerCase();
  if (!email) return null;
  if (config.allowedEmails.length && !config.allowedEmails.includes(email)) return null;
  return email;
}

function pinSessionValid(c: Context): boolean {
  const v = getCookie(c, COOKIE);
  if (!v) return false;
  const [issued, sig] = v.split(".");
  if (!issued || !sig) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(issued));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Date.now() - Number(issued) < SESSION_MAX_AGE_S * 1000;
}

export function whoami(c: Context): {
  user: string | null;
  host: boolean;
  mode: typeof config.authMode;
} {
  switch (config.authMode) {
    case "proxy": {
      const user = proxyUser(c);
      return { user, host: !!user, mode: "proxy" };
    }
    case "pin":
      return { user: null, host: pinSessionValid(c), mode: "pin" };
    case "none":
      return { user: "local", host: true, mode: "none" };
  }
}

/** Any authenticated viewer (display). In pin/none mode the display is open. */
export const requireViewer: MiddlewareHandler = async (c, next) => {
  if (config.authMode === "proxy" && !proxyUser(c)) return c.json({ error: "unauthorised" }, 401);
  await next();
};

export const requireHost: MiddlewareHandler = async (c, next) => {
  if (!whoami(c).host) return c.json({ error: "unauthorised" }, 401);
  await next();
};

export function pinLogin(c: Context, pin: string): boolean {
  const a = Buffer.from(pin);
  const b = Buffer.from(config.hostPin);
  if (config.authMode !== "pin" || a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const issued = String(Date.now());
  setCookie(c, COOKIE, `${issued}.${sign(issued)}`, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return true;
}
