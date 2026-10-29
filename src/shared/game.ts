import { z } from "zod";
import type { Match, Question, Team } from "./content";

/** Live game state. The server owns it; clients only see role-specific projections (view.ts). */

export interface Timer {
  durationMs: number;
  /** Epoch ms when the timer was last (re)started; null while paused or stopped. */
  startedAt: number | null;
  /** Remaining time as of `startedAt` (or now, if paused). */
  remainingMs: number;
}

export interface StandardLive {
  type: "standard";
  index: number;
  revealed: boolean;
  awarded: string[];
  penalised: string[];
}

export interface ConnectionLive {
  type: "connection" | "sequence";
  phase: "pick" | "play" | "steal" | "done";
  slot: number | null;
  teamId: string | null;
  /** Clues visible to everyone. */
  shown: number;
  stealTeamId: string | null;
  outcome: "correct" | "stolen" | "missed" | null;
  timer: Timer | null;
}

export interface WallLive {
  type: "wall";
  phase: "pick" | "play" | "connections" | "done";
  slot: number | null;
  teamId: string | null;
  /** Tile ids ("group:clue") in shuffled order. */
  order: string[];
  /** Group indices in the order they were found by the team. */
  found: number[];
  selected: string[];
  /** Null means unlimited (fewer than two groups found). */
  lives: number | null;
  /** Per group: whether the team named the connection. */
  connections: (boolean | null)[];
  timer: Timer | null;
  /** Bumped on each wrong guess so clients can animate. */
  wrongCount: number;
  scored: boolean;
}

export interface VowelsLive {
  type: "vowels";
  categoryIndex: number;
  /** -1 while showing the category title. */
  clueIndex: number;
  revealed: boolean;
  buzzed: string | null;
  /** Teams that answered the current clue wrongly. */
  wrong: string[];
  correctTeamId: string | null;
  timer: Timer | null;
  started: boolean;
  ended: boolean;
}

export type Live = StandardLive | ConnectionLive | WallLive | VowelsLive;

export type Screen = "holding" | "scoreboard" | "round" | "leaderboard";

export interface GameState {
  matchId: string | null;
  screen: Screen;
  roundIndex: number | null;
  /** Index into match.teamIds of the team whose turn it is. */
  turn: number;
  scores: Record<string, number>;
  live: Live | null;
  /** Question ids fully played in this match. */
  played: string[];
  /** Final scores of finished matches, for the leaderboard. */
  results: Record<string, Record<string, number>>;
}

export const initialState: GameState = {
  matchId: null,
  screen: "holding",
  roundIndex: null,
  turn: 0,
  scores: {},
  live: null,
  played: [],
  results: {},
};

const id = z.string().min(1);

export const ActionSchema = z.discriminatedUnion("type", [
  // Match / navigation
  z.object({ type: z.literal("startMatch"), matchId: id }),
  z.object({ type: z.literal("endMatch") }),
  z.object({
    type: z.literal("setScreen"),
    screen: z.enum(["holding", "scoreboard", "round", "leaderboard"]),
  }),
  z.object({ type: z.literal("goToRound"), index: z.number().int().min(0) }),
  z.object({ type: z.literal("setTurn"), teamId: id }),
  z.object({ type: z.literal("adjustScore"), teamId: id, delta: z.number().int() }),
  z.object({ type: z.literal("pauseTimer") }),
  z.object({ type: z.literal("resumeTimer") }),
  z.object({ type: z.literal("timerExpired") }),
  // Standard
  z.object({ type: z.literal("standardGo"), index: z.number().int().min(0) }),
  z.object({ type: z.literal("standardReveal"), revealed: z.boolean() }),
  z.object({ type: z.literal("standardAward"), teamId: id }),
  z.object({ type: z.literal("standardPenalise"), teamId: id }),
  // Connections / Sequences
  z.object({ type: z.literal("pickSlot"), slot: z.number().int().min(0).max(5) }),
  z.object({ type: z.literal("nextClue") }),
  z.object({ type: z.literal("answerCorrect") }),
  z.object({ type: z.literal("answerWrong") }),
  z.object({ type: z.literal("steal"), teamId: id.nullable(), correct: z.boolean() }),
  z.object({ type: z.literal("backToPick") }),
  // Wall
  z.object({ type: z.literal("tapTile"), tileId: id }),
  z.object({ type: z.literal("resolveWall") }),
  z.object({
    type: z.literal("markConnection"),
    group: z.number().int().min(0).max(3),
    correct: z.boolean(),
  }),
  z.object({ type: z.literal("finishWall") }),
  // Missing Vowels
  z.object({ type: z.literal("vowelsStart") }),
  z.object({ type: z.literal("vowelsNext") }),
  z.object({ type: z.literal("vowelsBuzz"), teamId: id.nullable() }),
  z.object({ type: z.literal("vowelsJudge"), correct: z.boolean() }),
  z.object({ type: z.literal("vowelsReveal") }),
]);
export type Action = z.infer<typeof ActionSchema>;

/** Host-only meta actions handled by the server rather than the reducer. */
export const HostMessageSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("action"), action: ActionSchema }),
  z.object({ kind: z.literal("undo") }),
  z.object({ kind: z.literal("ping") }),
]);
export type HostMessage = z.infer<typeof HostMessageSchema>;

export interface Content {
  teams: Map<string, Team>;
  questions: Map<string, Question>;
  matches: Map<string, Match>;
}

export class GameError extends Error {}

export const CONNECTION_POINTS = [5, 3, 2, 1] as const;
export const WALL_LIVES = 3;
