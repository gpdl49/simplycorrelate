import { randomInt } from "node:crypto";
import type { WSContext } from "hono/ws";
import { reduce, timerDeadline } from "../shared/engine";
import { type Action, GameError, type GameState, initialState } from "../shared/game";
import { buildView, type Role } from "../shared/view";
import { kvGet, kvSet } from "./db";
import { getContent, onContentChange } from "./store";

/** Owns the live game: applies host actions, persists state, schedules timers, broadcasts views. */

const UNDO_DEPTH = 100;

export type ServerMessage =
  | { kind: "view"; view: ReturnType<typeof buildView> }
  | { kind: "error"; message: string }
  | { kind: "pong"; serverNow: number };

interface Client {
  ws: WSContext;
  role: Role;
}

class Hub {
  private state: GameState = kvGet<GameState>("game:state") ?? initialState;
  private undo: GameState[] = kvGet<GameState[]>("game:undo") ?? [];
  private clients = new Set<Client>();
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    onContentChange(() => this.broadcast());
    this.schedule();
  }

  add(ws: WSContext, role: Role): Client {
    const c = { ws, role };
    this.clients.add(c);
    this.send(c);
    return c;
  }

  remove(c: Client): void {
    this.clients.delete(c);
  }

  dispatch(action: Action): void {
    const next = reduce(this.state, action, {
      content: getContent(),
      now: Date.now(),
      seed: randomInt(2 ** 31),
    });
    if (next === this.state) return;
    if (action.type !== "timerExpired") {
      this.undo = [...this.undo.slice(-(UNDO_DEPTH - 1)), this.state];
    }
    this.commit(next);
  }

  undoLast(): void {
    const prev = this.undo.at(-1);
    if (!prev) throw new GameError("Nothing to undo");
    this.undo = this.undo.slice(0, -1);
    this.commit(prev);
  }

  private commit(next: GameState): void {
    this.state = next;
    kvSet("game:state", this.state);
    kvSet("game:undo", this.undo);
    this.schedule();
    this.broadcast();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const deadline = timerDeadline(this.state);
    if (deadline === null) return;
    this.timer = setTimeout(
      () => {
        try {
          this.dispatch({ type: "timerExpired" });
        } catch (e) {
          console.error("timerExpired failed", e);
        }
      },
      Math.max(0, deadline - Date.now()) + 20,
    );
  }

  private broadcast(): void {
    const content = getContent();
    const now = Date.now();
    const views: Partial<Record<Role, string>> = {};
    for (const c of this.clients) {
      views[c.role] ??= JSON.stringify({
        kind: "view",
        view: buildView(this.state, content, c.role, now),
      } satisfies ServerMessage);
      c.ws.send(views[c.role]!);
    }
  }

  send(c: Client): void {
    const msg: ServerMessage = {
      kind: "view",
      view: buildView(this.state, getContent(), c.role, Date.now()),
    };
    c.ws.send(JSON.stringify(msg));
  }
}

export const hub = new Hub();
