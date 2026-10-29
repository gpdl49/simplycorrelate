import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, HostMessage } from "../../shared/game";
import type { GameView, Role } from "../../shared/view";

type ServerMessage =
  | { kind: "view"; view: GameView }
  | { kind: "error"; message: string }
  | { kind: "pong"; serverNow: number };

export interface GameConnection {
  view: GameView | null;
  connected: boolean;
  /** Last error from the server (e.g. invalid action); cleared on the next view. */
  error: string | null;
  unauthorised: boolean;
  /** serverNow − Date.now(), so timers render in server time. */
  clockOffset: number;
  dispatch: (action: Action) => void;
  undo: () => void;
}

/** Live game connection with auto-reconnect and a 25s keepalive (Envoy idles out at 5 min). */
export function useGame(role: Role): GameConnection {
  const [view, setView] = useState<GameView | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorised, setUnauthorised] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let stopped = false;
    let retry = 0;
    let retryTimer: number | undefined;
    let ping: number | undefined;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws?role=${role}`);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setConnected(true);
        ping = window.setInterval(
          () => ws.send(JSON.stringify({ kind: "ping" } satisfies HostMessage)),
          25_000,
        );
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string) as ServerMessage;
        if (msg.kind === "view") {
          setView(msg.view);
          setError(null);
          setClockOffset(msg.view.serverNow - Date.now());
        } else if (msg.kind === "error") {
          if (msg.message === "unauthorised") setUnauthorised(true);
          setError(msg.message);
        } else {
          setClockOffset(msg.serverNow - Date.now());
        }
      };
      ws.onclose = (e) => {
        window.clearInterval(ping);
        setConnected(false);
        if (stopped) return;
        if (e.code === 4401) {
          setUnauthorised(true);
          return;
        }
        retryTimer = window.setTimeout(connect, Math.min(5000, 300 * 2 ** retry++));
      };
    };
    connect();

    const onVisible = () => {
      if (document.visibilityState === "visible" && wsRef.current?.readyState !== WebSocket.OPEN) {
        window.clearTimeout(retryTimer);
        retry = 0;
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(ping);
      document.removeEventListener("visibilitychange", onVisible);
      wsRef.current?.close();
    };
  }, [role]);

  const send = useCallback((msg: HostMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else setError("Not connected");
  }, []);

  return {
    view,
    connected,
    error,
    unauthorised,
    clockOffset,
    dispatch: useCallback((action: Action) => send({ kind: "action", action }), [send]),
    undo: useCallback(() => send({ kind: "undo" }), [send]),
  };
}
