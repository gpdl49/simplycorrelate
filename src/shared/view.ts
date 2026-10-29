import {
  type Clue,
  type ConnectionQuestion,
  GLYPHS,
  type Match,
  type Media,
  type Round,
  roundTitle,
  type StandardQuestion,
  type Team,
  type VowelsQuestion,
  type WallQuestion,
} from "./content";
import {
  currentMatch,
  currentRound,
  roundQuestion,
  tileGroup,
  turnTeamId,
  wallScore,
} from "./engine";
import { CONNECTION_POINTS, type Content, type GameState, type Timer } from "./game";
import { puzzleFor } from "./vowels";

/**
 * What a client renders. The display never receives an answer before it is revealed;
 * the host receives everything. Built on the server per role and sent over the WebSocket.
 */

export type Role = "display" | "host";

export interface SlotView {
  slot: number;
  glyph: (typeof GLYPHS)[number];
  available: boolean;
  /** Host-only label of the question behind the glyph. */
  label?: string;
}

export interface StandardView {
  type: "standard";
  index: number;
  total: number;
  prompt: string;
  media?: Media;
  points: number;
  penalty: number;
  revealed: boolean;
  answer?: string;
  awarded: string[];
  penalised: string[];
  label?: string;
}

export interface ConnectionView {
  type: "connection" | "sequence";
  phase: "pick" | "play" | "steal" | "done";
  slots: SlotView[];
  teamId: string | null;
  stealTeamId: string | null;
  outcome: "correct" | "stolen" | "missed" | null;
  shown: number;
  /** Display: only the shown clues. Host: all four. */
  clues: Clue[];
  /** Points the playing team would win right now. */
  pointsNow: number;
  connection?: string;
  explanation?: string;
  label?: string;
  timer: Timer | null;
}

export interface TileView {
  id: string;
  text: string;
  /** Group index once found or resolved (host: always). */
  group: number | null;
  found: boolean;
}

export interface WallView {
  type: "wall";
  phase: "pick" | "play" | "connections" | "done";
  slots: SlotView[];
  teamId: string | null;
  /** Found groups first (in found order), then unresolved tiles in shuffled order; resolved walls show all groups in rows. */
  tiles: TileView[];
  selected: string[];
  lives: number | null;
  foundCount: number;
  /** Per group (by group index): the connection, once the wall is no longer in play (host: always). */
  connections: { connection?: string; correct: boolean | null }[];
  score: number;
  wrongCount: number;
  label?: string;
  timer: Timer | null;
}

export interface VowelsView {
  type: "vowels";
  started: boolean;
  ended: boolean;
  category: string | null;
  categoryIndex: number;
  categoryCount: number;
  clueIndex: number;
  clueCount: number;
  puzzle: string | null;
  answer?: string;
  revealed: boolean;
  buzzed: string | null;
  wrong: string[];
  correctTeamId: string | null;
  timer: Timer | null;
  /** Host-only peek at the upcoming category. */
  nextCategory?: string;
}

export type RoundView = StandardView | ConnectionView | WallView | VowelsView;

export interface GameView {
  role: Role;
  serverNow: number;
  screen: GameState["screen"];
  match: {
    id: string;
    name: string;
    rounds: { id: string; type: Round["type"]; title: string }[];
  } | null;
  teams: Team[];
  scores: Record<string, number>;
  turnTeamId: string | null;
  roundIndex: number | null;
  round: RoundView | null;
  /** Leaderboard: totals across finished matches plus the current one. */
  leaderboard: { teamId: string; total: number }[];
  /** Host-only: all matches, to start one. */
  matches?: { id: string; name: string; locked: boolean }[];
}

function slotsFor(
  round: Round,
  state: GameState,
  content: Content,
  host: boolean,
  type: "connection" | "wall",
): SlotView[] {
  const n = type === "wall" ? Math.min(round.questionIds.length, 6) : 6;
  return GLYPHS.slice(0, n).map((glyph, slot) => {
    const q = content.questions.get(round.questionIds[slot] ?? "");
    const v: SlotView = { slot, glyph, available: !!q && !state.played.includes(q.id) };
    if (host && q) v.label = q.label || `#${slot + 1}`;
    return v;
  });
}

export function buildView(state: GameState, content: Content, role: Role, now: number): GameView {
  const host = role === "host";
  const match = currentMatch(state, content);
  const round = currentRound(state, content);
  const teams = (match?.teamIds ?? [...content.teams.keys()])
    .map((id) => content.teams.get(id))
    .filter((t): t is Team => !!t);

  const totals = new Map<string, number>();
  const results = { ...state.results };
  if (match) results[match.id] = state.scores;
  for (const scores of Object.values(results)) {
    for (const [t, s] of Object.entries(scores)) totals.set(t, (totals.get(t) ?? 0) + s);
  }

  const view: GameView = {
    role,
    serverNow: now,
    screen: state.screen,
    match: match ? matchSummary(match) : null,
    teams,
    scores: state.scores,
    turnTeamId: match ? turnTeamId(state, match) : null,
    roundIndex: state.roundIndex,
    round: round ? roundView(state, round, content, host) : null,
    leaderboard: [...content.teams.keys()]
      .map((teamId) => ({ teamId, total: totals.get(teamId) ?? 0 }))
      .sort((a, b) => b.total - a.total),
  };
  if (host) {
    view.matches = [...content.matches.values()].map((m) => ({
      id: m.id,
      name: m.name,
      locked: m.locked,
    }));
    // Host needs all teams for the leaderboard names.
    const extra = [...content.teams.values()].filter((t) => !teams.some((x) => x.id === t.id));
    view.teams = [...teams, ...extra];
  } else if (state.screen === "leaderboard") {
    view.teams = [...content.teams.values()];
  }
  return view;
}

function matchSummary(m: Match): NonNullable<GameView["match"]> {
  return {
    id: m.id,
    name: m.name,
    rounds: m.rounds.map((r) => ({ id: r.id, type: r.type, title: roundTitle(r) })),
  };
}

function roundView(
  state: GameState,
  round: Round,
  content: Content,
  host: boolean,
): RoundView | null {
  const live = state.live;
  if (!live) return null;
  switch (live.type) {
    case "standard": {
      const q = roundQuestion<StandardQuestion>(round, live.index, content, "standard");
      const v: StandardView = {
        type: "standard",
        index: live.index,
        total: round.questionIds.length,
        prompt: q?.prompt ?? "(missing question)",
        points: q?.points ?? 1,
        penalty: q?.penalty ?? 0,
        revealed: live.revealed,
        awarded: live.awarded,
        penalised: live.penalised,
      };
      if (q?.media) v.media = q.media;
      if (host || live.revealed) v.answer = q?.answer ?? "";
      if (host && q) v.label = q.label;
      return v;
    }
    case "connection":
    case "sequence": {
      const q = roundQuestion<ConnectionQuestion>(round, live.slot, content, [
        "connection",
        "sequence",
      ]);
      const done = live.phase === "done";
      // Sequences hide the fourth clue (the answer) until done.
      const visible = live.type === "sequence" && !done ? Math.min(live.shown, 3) : live.shown;
      const v: ConnectionView = {
        type: live.type,
        phase: live.phase,
        slots: slotsFor(round, state, content, host, "connection"),
        teamId: live.teamId,
        stealTeamId: live.stealTeamId,
        outcome: live.outcome,
        shown: live.shown,
        clues: q ? (host ? q.clues : q.clues.slice(0, visible)) : [],
        pointsNow: CONNECTION_POINTS[Math.max(0, live.shown - 1)] ?? 1,
        timer: live.timer,
      };
      if (q && (host || done)) v.connection = q.connection;
      if (q && host) {
        v.explanation = q.explanation;
        v.label = q.label;
      }
      return v;
    }
    case "wall": {
      const q = roundQuestion<WallQuestion>(round, live.slot, content, "wall");
      const resolved = live.phase === "connections" || live.phase === "done";
      const text = (id: string) => {
        const [g, c] = id.split(":").map(Number);
        return q?.groups[g!]?.clues[c!] ?? "";
      };
      const foundTiles = live.found.flatMap((g) => live.order.filter((t) => tileGroup(t) === g));
      let rest = live.order.filter((t) => !live.found.includes(tileGroup(t)));
      if (resolved) {
        // Arrange unfound groups into rows so the audience sees the solution.
        rest = [...new Set(rest.map(tileGroup))].flatMap((g) =>
          rest.filter((t) => tileGroup(t) === g),
        );
      }
      const tiles: TileView[] = [...foundTiles, ...rest].map((id) => {
        const found = live.found.includes(tileGroup(id));
        return {
          id,
          text: text(id),
          found,
          group: found || resolved || host ? tileGroup(id) : null,
        };
      });
      return {
        type: "wall",
        phase: live.phase,
        slots: slotsFor(round, state, content, host, "wall"),
        teamId: live.teamId,
        tiles,
        selected: live.selected,
        lives: live.lives,
        foundCount: live.found.length,
        connections: [0, 1, 2, 3].map((g) => {
          const c: WallView["connections"][number] = { correct: live.connections[g] ?? null };
          if (q && (host || resolved)) c.connection = q.groups[g]!.connection;
          return c;
        }),
        score: wallScore(live),
        wrongCount: live.wrongCount,
        timer: live.timer,
        ...(host && q ? { label: q.label } : {}),
      };
    }
    case "vowels": {
      const cats = round.questionIds
        .map((id) => content.questions.get(id))
        .filter((q): q is VowelsQuestion => q?.type === "vowels");
      const cat = cats[live.categoryIndex];
      const clue = live.clueIndex >= 0 ? cat?.clues[live.clueIndex] : undefined;
      const v: VowelsView = {
        type: "vowels",
        started: live.started,
        ended: live.ended,
        category: cat?.category ?? null,
        categoryIndex: live.categoryIndex,
        categoryCount: cats.length,
        clueIndex: live.clueIndex,
        clueCount: cat?.clues.length ?? 0,
        puzzle: clue ? puzzleFor(clue) : null,
        revealed: live.revealed,
        buzzed: live.buzzed,
        wrong: live.wrong,
        correctTeamId: live.correctTeamId,
        timer: live.timer,
      };
      if (clue && (host || live.revealed)) v.answer = clue.answer;
      if (host) {
        const next = cats[live.categoryIndex + 1];
        if (next) v.nextCategory = next.category;
      }
      return v;
    }
  }
}
