import {
  type CategoryQuestion,
  type ConnectionQuestion,
  type Match,
  type Question,
  type Round,
  roundTimerSec,
  type StandardQuestion,
  type VowelsQuestion,
  type WallQuestion,
} from "./content";
import {
  type Action,
  type BoardLive,
  CONNECTION_POINTS,
  type ConnectionLive,
  type Content,
  GameError,
  type GameState,
  type Live,
  type StandardLive,
  type Timer,
  type VowelsLive,
  WALL_LIVES,
  type WallLive,
} from "./game";

export interface Ctx {
  content: Content;
  now: number;
  /** Random seed for shuffles, supplied by the server so the reducer stays pure. */
  seed: number;
}

// ---------- timers ----------

export function startTimer(durationMs: number, now: number): Timer {
  return { durationMs, startedAt: now, remainingMs: durationMs };
}

export function timerRemaining(t: Timer | null, now: number): number {
  if (!t) return 0;
  if (t.startedAt === null) return t.remainingMs;
  return Math.max(0, t.remainingMs - (now - t.startedAt));
}

function pauseT(t: Timer | null, now: number): Timer | null {
  if (!t || t.startedAt === null) return t;
  return { ...t, startedAt: null, remainingMs: timerRemaining(t, now) };
}

function resumeT(t: Timer | null, now: number): Timer | null {
  if (!t || t.startedAt !== null || t.remainingMs <= 0) return t;
  return { ...t, startedAt: now };
}

const stopT = pauseT;

/** Epoch ms at which the running timer (if any) expires; the server schedules `timerExpired`. */
export function timerDeadline(state: GameState): number | null {
  const t = state.live && "timer" in state.live ? state.live.timer : null;
  if (!t || t.startedAt === null) return null;
  return t.startedAt + t.remainingMs;
}

// ---------- lookups ----------

export function currentMatch(state: GameState, content: Content): Match | null {
  return state.matchId ? (content.matches.get(state.matchId) ?? null) : null;
}

export function currentRound(state: GameState, content: Content): Round | null {
  const m = currentMatch(state, content);
  if (!m || state.roundIndex === null) return null;
  return m.rounds[state.roundIndex] ?? null;
}

export function roundQuestion<T extends Question>(
  round: Round,
  index: number | null,
  content: Content,
  type: T["type"] | T["type"][],
): T | null {
  if (index === null) return null;
  const qid = round.questionIds[index];
  const q = qid ? content.questions.get(qid) : undefined;
  const types = Array.isArray(type) ? type : [type];
  return q && types.includes(q.type) ? (q as T) : null;
}

export function turnTeamId(state: GameState, match: Match): string | null {
  return match.teamIds[state.turn % match.teamIds.length] ?? null;
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const j = (s >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function tileGroup(tileId: string): number {
  return Number(tileId.split(":")[0]);
}

// ---------- round initialisation ----------

function initLive(round: Round): Live {
  switch (round.type) {
    case "standard":
      return { type: "standard", index: 0, revealed: false, awarded: [], penalised: [] };
    case "connection":
    case "sequence":
      return {
        type: round.type,
        phase: "pick",
        slot: null,
        teamId: null,
        shown: 0,
        stealTeamId: null,
        outcome: null,
        timer: null,
      };
    case "wall":
      return {
        type: "wall",
        phase: "pick",
        slot: null,
        teamId: null,
        order: [],
        found: [],
        selected: [],
        lives: null,
        connections: [null, null, null, null],
        timer: null,
        wrongCount: 0,
        scored: false,
      };
    case "vowels":
      return {
        type: "vowels",
        categoryIndex: 0,
        clueIndex: -1,
        revealed: false,
        buzzed: null,
        wrong: [],
        correctTeamId: null,
        timer: null,
        started: false,
        ended: false,
      };
    case "board":
      return {
        type: "board",
        phase: "pick",
        cell: null,
        teamId: null,
        wrong: [],
        answeredBy: null,
        timer: null,
      };
  }
}

/** Key recorded in `state.played` for a used board cell. */
export function boardCellKey(questionId: string, clue: number): string {
  return `${questionId}#${clue}`;
}

// ---------- reducer ----------

function addScore(state: GameState, teamId: string, delta: number): GameState {
  return { ...state, scores: { ...state.scores, [teamId]: (state.scores[teamId] ?? 0) + delta } };
}

function markPlayed(state: GameState, qid: string | undefined): GameState {
  if (!qid || state.played.includes(qid)) return state;
  return { ...state, played: [...state.played, qid] };
}

function requireMatch(state: GameState, content: Content): Match {
  const m = currentMatch(state, content);
  if (!m) throw new GameError("No match in progress");
  return m;
}

function requireTeam(match: Match, teamId: string): string {
  if (!match.teamIds.includes(teamId)) throw new GameError("Team is not in this match");
  return teamId;
}

function requireLive<T extends Live["type"]>(
  state: GameState,
  types: T[],
): Extract<Live, { type: T }> {
  const live = state.live;
  if (!live || !(types as string[]).includes(live.type)) {
    throw new GameError(`Not in a ${types.join("/")} round`);
  }
  return live as Extract<Live, { type: T }>;
}

function withLive(state: GameState, live: Live): GameState {
  return { ...state, live };
}

export function reduce(state: GameState, action: Action, ctx: Ctx): GameState {
  const { content, now } = ctx;
  switch (action.type) {
    case "startMatch": {
      const m = content.matches.get(action.matchId);
      if (!m) throw new GameError("Unknown match");
      // Keep the interrupted match's scores on the leaderboard.
      const results = state.matchId
        ? { ...state.results, [state.matchId]: state.scores }
        : state.results;
      return {
        ...state,
        results,
        matchId: m.id,
        screen: "scoreboard",
        roundIndex: null,
        turn: 0,
        scores: Object.fromEntries(m.teamIds.map((t) => [t, 0])),
        live: null,
        played: [],
      };
    }
    case "endMatch": {
      const m = requireMatch(state, content);
      return {
        ...state,
        results: { ...state.results, [m.id]: state.scores },
        screen: "scoreboard",
        live: null,
        roundIndex: null,
      };
    }
    case "setScreen":
      return { ...state, screen: action.screen };
    case "goToRound": {
      const m = requireMatch(state, content);
      const round = m.rounds[action.index];
      if (!round) throw new GameError("No such round");
      return { ...state, roundIndex: action.index, screen: "round", live: initLive(round) };
    }
    case "setTurn": {
      const m = requireMatch(state, content);
      const i = m.teamIds.indexOf(action.teamId);
      if (i < 0) throw new GameError("Team is not in this match");
      return { ...state, turn: i };
    }
    case "adjustScore": {
      const m = requireMatch(state, content);
      return addScore(state, requireTeam(m, action.teamId), action.delta);
    }
    case "pauseTimer":
    case "resumeTimer": {
      const live = state.live;
      if (!live || !("timer" in live) || !live.timer) throw new GameError("No timer");
      if (action.type === "resumeTimer" && !timerActive(live)) {
        throw new GameError("Nothing is in play");
      }
      const timer =
        action.type === "pauseTimer" ? pauseT(live.timer, now) : resumeT(live.timer, now);
      return withLive(state, { ...live, timer } as Live);
    }
    case "timerExpired":
      return onTimerExpired(state, ctx);

    case "standardGo":
    case "standardReveal":
    case "standardAward":
    case "standardPenalise":
      return reduceStandard(state, action, ctx);

    case "pickSlot": {
      const live = requireLive(state, ["connection", "sequence", "wall"]);
      return live.type === "wall"
        ? pickWall(state, live, action.slot, ctx)
        : pickConnection(state, live, action.slot, ctx);
    }
    case "pickCell":
      return reduceBoard(state, action, ctx);
    case "answerCorrect":
    case "answerWrong":
    case "steal":
      if (state.live?.type === "board") return reduceBoard(state, action, ctx);
      return reduceConnection(state, action, ctx);
    case "nextClue":
      return reduceConnection(state, action, ctx);
    case "backToPick": {
      const live = requireLive(state, ["connection", "sequence", "wall", "board"]);
      if (live.phase !== "done") throw new GameError("Finish the current question first");
      const m = requireMatch(state, content);
      const next = { ...state, turn: (state.turn + 1) % m.teamIds.length };
      const round = currentRound(state, content)!;
      return withLive(next, initLive(round) as typeof live);
    }

    case "tapTile":
    case "resolveWall":
    case "markConnection":
    case "finishWall":
      return reduceWall(state, action, ctx);

    case "vowelsStart":
    case "vowelsNext":
    case "vowelsBuzz":
    case "vowelsJudge":
    case "vowelsReveal":
      return reduceVowels(state, action, ctx);
  }
}

/** Whether the live round is in a phase where its timer may run (stopped timers stay stopped). */
function timerActive(live: Live): boolean {
  switch (live.type) {
    case "standard":
      return false;
    case "connection":
    case "sequence":
    case "wall":
      return live.phase === "play";
    case "vowels":
      return live.started && !live.ended;
    case "board":
      return live.phase === "play";
  }
}

function onTimerExpired(state: GameState, ctx: Ctx): GameState {
  const live = state.live;
  if (!live || !("timer" in live) || !live.timer) return state;
  // Ignore stale expiries (timer paused/extended since scheduling).
  if (live.timer.startedAt === null || timerRemaining(live.timer, ctx.now) > 50) return state;
  const timer = { ...live.timer, startedAt: null, remainingMs: 0 };
  switch (live.type) {
    case "connection":
    case "sequence":
      if (live.phase !== "play") return state;
      return toSteal(state, { ...live, timer });
    case "wall":
      if (live.phase !== "play") return state;
      return withLive(state, { ...live, timer, phase: "connections", selected: [] });
    case "vowels":
      return withLive(state, { ...live, timer, ended: true });
    case "board":
      if (live.phase !== "play") return state;
      return boardWrong(state, { ...live, timer }, ctx, false);
  }
}

// ---------- standard ----------

function reduceStandard(
  state: GameState,
  action: Extract<Action, { type: `standard${string}` }>,
  ctx: Ctx,
): GameState {
  const live = requireLive(state, ["standard"]);
  const round = currentRound(state, ctx.content)!;
  const m = requireMatch(state, ctx.content);
  const q = roundQuestion<StandardQuestion>(round, live.index, ctx.content, "standard");
  switch (action.type) {
    case "standardGo": {
      if (action.index >= round.questionIds.length) throw new GameError("No such question");
      if (action.index === live.index) return state;
      const done = markPlayed(state, round.questionIds[live.index]);
      // Remember who was marked on each question so revisiting one can't double-award.
      const marks = {
        ...live.marks,
        [live.index]: { awarded: live.awarded, penalised: live.penalised },
      };
      const prev = marks[action.index];
      return withLive(done, {
        ...live,
        index: action.index,
        revealed: false,
        awarded: prev?.awarded ?? [],
        penalised: prev?.penalised ?? [],
        marks,
      } satisfies StandardLive);
    }
    case "standardReveal": {
      const next = action.revealed ? markPlayed(state, round.questionIds[live.index]) : state;
      return withLive(next, { ...live, revealed: action.revealed });
    }
    case "standardAward":
    case "standardPenalise": {
      if (!q) throw new GameError("Question missing");
      const teamId = requireTeam(m, action.teamId);
      const key = action.type === "standardAward" ? "awarded" : "penalised";
      const per = action.type === "standardAward" ? q.points : -q.penalty;
      const has = live[key].includes(teamId);
      const list = has ? live[key].filter((t) => t !== teamId) : [...live[key], teamId];
      return withLive(addScore(state, teamId, has ? -per : per), { ...live, [key]: list });
    }
  }
}

// ---------- connections / sequences ----------

function maxClues(live: ConnectionLive): number {
  return live.type === "sequence" ? 3 : 4;
}

function pickConnection(state: GameState, live: ConnectionLive, slot: number, ctx: Ctx): GameState {
  if (live.phase !== "pick") throw new GameError("A question is already in play");
  const round = currentRound(state, ctx.content)!;
  const m = requireMatch(state, ctx.content);
  const q = roundQuestion<ConnectionQuestion>(round, slot, ctx.content, ["connection", "sequence"]);
  if (!q) throw new GameError("No question in that slot");
  if (state.played.includes(q.id)) throw new GameError("Already played");
  const secs = roundTimerSec(round);
  return withLive(markPlayed(state, q.id), {
    ...live,
    phase: "play",
    slot,
    teamId: turnTeamId(state, m),
    shown: 1,
    timer: secs ? startTimer(secs * 1000, ctx.now) : null,
  });
}

function toSteal(state: GameState, live: ConnectionLive): GameState {
  return withLive(state, { ...live, phase: "steal", shown: maxClues(live) });
}

function reduceConnection(
  state: GameState,
  action: Extract<Action, { type: "nextClue" | "answerCorrect" | "answerWrong" | "steal" }>,
  ctx: Ctx,
): GameState {
  const live = requireLive(state, ["connection", "sequence"]);
  const m = requireMatch(state, ctx.content);
  switch (action.type) {
    case "nextClue":
      if (live.phase !== "play") throw new GameError("Not in play");
      if (live.shown >= maxClues(live)) throw new GameError("All clues shown");
      return withLive(state, { ...live, shown: live.shown + 1 });
    case "answerCorrect": {
      if (live.phase !== "play" || !live.teamId) throw new GameError("Not in play");
      const pts = CONNECTION_POINTS[live.shown - 1] ?? 1;
      return withLive(addScore(state, live.teamId, pts), {
        ...live,
        phase: "done",
        outcome: "correct",
        shown: 4,
        timer: stopT(live.timer, ctx.now),
      });
    }
    case "answerWrong":
      if (live.phase !== "play") throw new GameError("Not in play");
      return toSteal(state, { ...live, timer: stopT(live.timer, ctx.now) });
    case "steal": {
      if (live.phase !== "steal") throw new GameError("Not offering a steal");
      if (action.teamId !== null) {
        requireTeam(m, action.teamId);
        if (action.teamId === live.teamId) throw new GameError("That team already answered");
      }
      if (action.teamId === null || !action.correct) {
        return withLive(state, {
          ...live,
          phase: "done",
          outcome: "missed",
          shown: 4,
          stealTeamId: action.teamId,
        });
      }
      const teamId = action.teamId;
      return withLive(addScore(state, teamId, 1), {
        ...live,
        phase: "done",
        outcome: "stolen",
        shown: 4,
        stealTeamId: teamId,
      });
    }
  }
}

// ---------- wall ----------

function pickWall(state: GameState, live: WallLive, slot: number, ctx: Ctx): GameState {
  if (live.phase !== "pick") throw new GameError("A wall is already in play");
  const round = currentRound(state, ctx.content)!;
  const m = requireMatch(state, ctx.content);
  const q = roundQuestion<WallQuestion>(round, slot, ctx.content, "wall");
  if (!q) throw new GameError("No wall in that slot");
  if (state.played.includes(q.id)) throw new GameError("Already played");
  const tiles = q.groups.flatMap((g, gi) => g.clues.map((_, ci) => `${gi}:${ci}`));
  const secs = roundTimerSec(round);
  return withLive(markPlayed(state, q.id), {
    ...live,
    phase: "play",
    slot,
    teamId: turnTeamId(state, m),
    order: shuffle(tiles, ctx.seed),
    timer: secs ? startTimer(secs * 1000, ctx.now) : null,
  });
}

export function wallScore(live: WallLive): number {
  const groups = live.found.length;
  const conns = live.connections.filter((c) => c === true).length;
  return groups + conns + (groups === 4 && conns === 4 ? 2 : 0);
}

function reduceWall(
  state: GameState,
  action: Extract<Action, { type: "tapTile" | "resolveWall" | "markConnection" | "finishWall" }>,
  ctx: Ctx,
): GameState {
  const live = requireLive(state, ["wall"]);
  switch (action.type) {
    case "tapTile": {
      if (live.phase !== "play") throw new GameError("Wall not in play");
      if (!live.order.includes(action.tileId)) throw new GameError("Unknown tile");
      if (live.found.includes(tileGroup(action.tileId))) return state;
      if (live.selected.includes(action.tileId)) {
        return withLive(state, {
          ...live,
          selected: live.selected.filter((t) => t !== action.tileId),
        });
      }
      const selected = [...live.selected, action.tileId];
      if (selected.length < 4) return withLive(state, { ...live, selected });

      const g = tileGroup(selected[0]!);
      if (selected.every((t) => tileGroup(t) === g)) {
        let found = [...live.found, g];
        // Finding the third group solves the fourth automatically.
        if (found.length === 3) found = [...found, [0, 1, 2, 3].find((x) => !found.includes(x))!];
        const lives = found.length >= 2 ? (live.lives ?? WALL_LIVES) : null;
        const solved = found.length === 4;
        return withLive(state, {
          ...live,
          found,
          selected: [],
          lives,
          phase: solved ? "connections" : "play",
          timer: solved ? stopT(live.timer, ctx.now) : live.timer,
        });
      }
      const lives = live.lives === null ? null : live.lives - 1;
      const out = lives !== null && lives <= 0;
      return withLive(state, {
        ...live,
        selected: [],
        lives,
        wrongCount: live.wrongCount + 1,
        phase: out ? "connections" : "play",
        timer: out ? stopT(live.timer, ctx.now) : live.timer,
      });
    }
    case "resolveWall":
      if (live.phase !== "play") throw new GameError("Wall not in play");
      return withLive(state, {
        ...live,
        phase: "connections",
        selected: [],
        timer: stopT(live.timer, ctx.now),
      });
    case "markConnection": {
      if (live.phase !== "connections") throw new GameError("Not marking connections");
      const connections = [...live.connections];
      connections[action.group] = action.correct;
      return withLive(state, { ...live, connections });
    }
    case "finishWall": {
      if (live.phase !== "connections" || !live.teamId)
        throw new GameError("Not marking connections");
      const connections = live.connections.map((c) => c ?? false);
      const done: WallLive = { ...live, connections, phase: "done", scored: true };
      return withLive(addScore(state, live.teamId, wallScore(done)), done);
    }
  }
}

// ---------- missing vowels ----------

function vowelsCategories(state: GameState, ctx: Ctx): VowelsQuestion[] {
  const round = currentRound(state, ctx.content)!;
  return round.questionIds
    .map((id) => ctx.content.questions.get(id))
    .filter((q): q is VowelsQuestion => q?.type === "vowels");
}

function reduceVowels(
  state: GameState,
  action: Extract<Action, { type: `vowels${string}` }>,
  ctx: Ctx,
): GameState {
  const live = requireLive(state, ["vowels"]);
  const m = requireMatch(state, ctx.content);
  const cats = vowelsCategories(state, ctx);
  const cat = cats[live.categoryIndex];
  switch (action.type) {
    case "vowelsStart": {
      if (live.started) throw new GameError("Already started");
      const secs = roundTimerSec(currentRound(state, ctx.content)!);
      return withLive(state, {
        ...live,
        started: true,
        timer: secs ? startTimer(secs * 1000, ctx.now) : null,
      } satisfies VowelsLive);
    }
    case "vowelsNext": {
      if (!cat) throw new GameError("No categories");
      if (live.ended) throw new GameError("The round is over");
      const fresh = { revealed: false, buzzed: null, wrong: [], correctTeamId: null };
      if (live.clueIndex + 1 < cat.clues.length) {
        return withLive(state, { ...live, ...fresh, clueIndex: live.clueIndex + 1 });
      }
      if (live.categoryIndex + 1 < cats.length) {
        return withLive(markPlayed(state, cat.id), {
          ...live,
          ...fresh,
          categoryIndex: live.categoryIndex + 1,
          clueIndex: -1,
        });
      }
      return withLive(markPlayed(state, cat.id), {
        ...live,
        ended: true,
        timer: stopT(live.timer, ctx.now),
      });
    }
    case "vowelsBuzz": {
      if (live.clueIndex < 0 || live.revealed) throw new GameError("No clue showing");
      if (live.ended) throw new GameError("The round is over");
      if (action.teamId !== null) {
        requireTeam(m, action.teamId);
        if (live.wrong.includes(action.teamId)) throw new GameError("That team already answered");
      }
      return withLive(state, { ...live, buzzed: action.teamId });
    }
    case "vowelsJudge": {
      if (!live.buzzed) throw new GameError("Nobody has buzzed");
      if (action.correct) {
        return withLive(addScore(state, live.buzzed, 1), {
          ...live,
          revealed: true,
          correctTeamId: live.buzzed,
          buzzed: null,
        });
      }
      return withLive(addScore(state, live.buzzed, -1), {
        ...live,
        wrong: [...live.wrong, live.buzzed],
        buzzed: null,
      });
    }
    case "vowelsReveal":
      if (live.clueIndex < 0) throw new GameError("No clue showing");
      return withLive(state, { ...live, revealed: true, buzzed: null });
  }
}

// ---------- category board ----------

export function boardCategories(round: Round, content: Content): (CategoryQuestion | null)[] {
  return round.questionIds.map((id) => {
    const q = content.questions.get(id);
    return q?.type === "category" ? q : null;
  });
}

function boardCell(state: GameState, live: BoardLive, ctx: Ctx) {
  const round = currentRound(state, ctx.content)!;
  if (!live.cell) throw new GameError("No question selected");
  const cat = boardCategories(round, ctx.content)[live.cell.category];
  const clue = cat?.clues[live.cell.clue];
  if (!cat || !clue) throw new GameError("Question missing");
  return { round, cat, clue };
}

/** A wrong answer (or timeout when `penalise` is false) by the picking team opens the steal. */
function boardWrong(state: GameState, live: BoardLive, ctx: Ctx, penalise: boolean): GameState {
  const { round, clue } = boardCell(state, live, ctx);
  const deduct = penalise && (round.negative ?? "steals") === "all" && live.teamId;
  const next = deduct ? addScore(state, live.teamId!, -clue.points) : state;
  return withLive(next, {
    ...live,
    phase: "steal",
    wrong: live.teamId ? [live.teamId] : [],
    timer: stopT(live.timer, ctx.now),
  });
}

function reduceBoard(
  state: GameState,
  action: Extract<Action, { type: "pickCell" | "answerCorrect" | "answerWrong" | "steal" }>,
  ctx: Ctx,
): GameState {
  const live = requireLive(state, ["board"]);
  const m = requireMatch(state, ctx.content);
  switch (action.type) {
    case "pickCell": {
      if (live.phase !== "pick") throw new GameError("A question is already in play");
      const round = currentRound(state, ctx.content)!;
      const cat = boardCategories(round, ctx.content)[action.category];
      if (!cat?.clues[action.clue]) throw new GameError("No question in that cell");
      const key = boardCellKey(cat.id, action.clue);
      if (state.played.includes(key)) throw new GameError("Already played");
      const secs = roundTimerSec(round);
      let next = markPlayed(state, key);
      // The category counts as played once every cell in it is used.
      if (cat.clues.every((_, i) => next.played.includes(boardCellKey(cat.id, i)))) {
        next = markPlayed(next, cat.id);
      }
      return withLive(next, {
        ...live,
        phase: "play",
        cell: { category: action.category, clue: action.clue },
        teamId: turnTeamId(state, m),
        wrong: [],
        answeredBy: null,
        timer: secs ? startTimer(secs * 1000, ctx.now) : null,
      });
    }
    case "answerCorrect": {
      if (live.phase !== "play" || !live.teamId) throw new GameError("Not in play");
      const { clue } = boardCell(state, live, ctx);
      return withLive(addScore(state, live.teamId, clue.points), {
        ...live,
        phase: "done",
        answeredBy: live.teamId,
        timer: stopT(live.timer, ctx.now),
      });
    }
    case "answerWrong":
      if (live.phase !== "play") throw new GameError("Not in play");
      return boardWrong(state, live, ctx, true);
    case "steal": {
      if (live.phase !== "steal") throw new GameError("Not offering a steal");
      if (action.teamId === null) return withLive(state, { ...live, phase: "done" });
      const teamId = requireTeam(m, action.teamId);
      if (live.wrong.includes(teamId)) throw new GameError("That team already answered");
      const { round, clue } = boardCell(state, live, ctx);
      if (action.correct) {
        return withLive(addScore(state, teamId, clue.points), {
          ...live,
          phase: "done",
          answeredBy: teamId,
        });
      }
      const negative = round.negative ?? "steals";
      const next = negative === "none" ? state : addScore(state, teamId, -clue.points);
      const wrong = [...live.wrong, teamId];
      // Everyone has had a go: close the question.
      const allTried = m.teamIds.every((t) => wrong.includes(t));
      return withLive(next, { ...live, wrong, phase: allTried ? "done" : "steal" });
    }
  }
}
