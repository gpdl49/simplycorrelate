import { describe, expect, it } from "vitest";
import { timerDeadline, timerRemaining } from "./engine";
import type { Action, ConnectionLive, StandardLive, VowelsLive, WallLive } from "./game";
import { Game } from "./testkit";

const zero = { a: 0, b: 0, c: 0 };

describe("match and navigation", () => {
  it("startMatch zeroes scores and shows the scoreboard", () => {
    const g = new Game().do({ type: "startMatch", matchId: "m1" });
    expect(g.scores).toEqual(zero);
    expect(g.state.screen).toBe("scoreboard");
  });

  it("rejects unknown matches, rounds and teams", () => {
    expect(() => new Game().do({ type: "startMatch", matchId: "nope" })).toThrow();
    expect(() => new Game().do({ type: "goToRound", index: 0 })).toThrow();
    const g = new Game().do({ type: "startMatch", matchId: "m1" });
    expect(() => g.do({ type: "goToRound", index: 99 })).toThrow();
    expect(() => g.do({ type: "adjustScore", teamId: "zzz", delta: 1 })).toThrow();
    expect(() => g.do({ type: "setTurn", teamId: "zzz" })).toThrow();
  });

  it("adjustScore, setTurn and endMatch", () => {
    const g = new Game().do(
      { type: "startMatch", matchId: "m1" },
      { type: "adjustScore", teamId: "b", delta: 3 },
      { type: "adjustScore", teamId: "b", delta: -1 },
      { type: "setTurn", teamId: "c" },
    );
    expect(g.scores.b).toBe(2);
    expect(g.state.turn).toBe(2);
    g.do({ type: "endMatch" });
    expect(g.state.results.m1).toEqual({ a: 0, b: 2, c: 0 });
    expect(g.state.live).toBeNull();
  });

  it("reducer is pure", () => {
    const g = Game.inRound("connection");
    const before = JSON.stringify(g.state);
    const s = g.state;
    g.do({ type: "pickSlot", slot: 0 });
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("standard", () => {
  const live = (g: Game) => g.live as StandardLive;

  it("award toggles on and off", () => {
    const g = Game.inRound("standard").do({ type: "standardAward", teamId: "a" });
    expect(g.scores.a).toBe(2);
    expect(live(g).awarded).toEqual(["a"]);
    g.do({ type: "standardAward", teamId: "a" });
    expect(g.scores.a).toBe(0);
    expect(live(g).awarded).toEqual([]);
  });

  it("several teams can be awarded", () => {
    const g = Game.inRound("standard").do(
      { type: "standardAward", teamId: "a" },
      { type: "standardAward", teamId: "c" },
    );
    expect(g.scores).toEqual({ a: 2, b: 0, c: 2 });
  });

  it("penalise toggles on and off", () => {
    const g = Game.inRound("standard").do({ type: "standardPenalise", teamId: "b" });
    expect(g.scores.b).toBe(-1);
    expect(live(g).penalised).toEqual(["b"]);
    g.do({ type: "standardPenalise", teamId: "b" });
    expect(g.scores.b).toBe(0);
    expect(live(g).penalised).toEqual([]);
  });

  it("penalty 0 disables negative marking", () => {
    const g = Game.inRound("standard").do(
      { type: "standardGo", index: 1 },
      { type: "standardPenalise", teamId: "b" },
    );
    expect(g.scores.b).toBe(0);
  });

  it("reveal, go and played tracking", () => {
    const g = Game.inRound("standard").do({ type: "standardReveal", revealed: true });
    expect(live(g).revealed).toBe(true);
    expect(g.state.played).toContain("s1");
    g.do({ type: "standardGo", index: 1 });
    expect(live(g)).toMatchObject({ index: 1, revealed: false, awarded: [] });
    expect(() => g.do({ type: "standardGo", index: 5 })).toThrow();
  });

  it("revisiting a question keeps its marks, so it can't be double-awarded", () => {
    const g = Game.inRound("standard").do(
      { type: "standardAward", teamId: "a" },
      { type: "standardGo", index: 1 },
      { type: "standardGo", index: 0 },
    );
    expect(live(g).awarded).toEqual(["a"]);
    g.do({ type: "standardAward", teamId: "a" });
    expect(g.scores.a).toBe(0);
  });

  it("rejects teams outside the match", () => {
    expect(() => Game.inRound("standard").do({ type: "standardAward", teamId: "zzz" })).toThrow();
  });
});

describe("connections", () => {
  const live = (g: Game) => g.live as ConnectionLive;
  const pick = (slot = 0) => Game.inRound("connection").do({ type: "pickSlot", slot });

  it.each([
    [1, 5],
    [2, 3],
    [3, 2],
    [4, 1],
  ])("correct after %i clue(s) scores %i", (clues, pts) => {
    const g = pick();
    for (let i = 1; i < clues; i++) g.do({ type: "nextClue" });
    g.do({ type: "answerCorrect" });
    expect(g.scores.a).toBe(pts);
    expect(live(g)).toMatchObject({ phase: "done", outcome: "correct", shown: 4 });
  });

  it("pick gives the question to the team on turn and starts the timer", () => {
    const g = pick(1);
    expect(live(g)).toMatchObject({ phase: "play", slot: 1, teamId: "a", shown: 1 });
    expect(live(g).timer?.durationMs).toBe(40_000);
    expect(g.state.played).toContain("c2");
  });

  it("can't show more than four clues", () => {
    const g = pick().do({ type: "nextClue" }, { type: "nextClue" }, { type: "nextClue" });
    expect(() => g.do({ type: "nextClue" })).toThrow();
  });

  it("can't pick while in play, an empty slot or a played slot", () => {
    expect(() => pick().do({ type: "pickSlot", slot: 1 })).toThrow();
    expect(() => Game.inRound("connection").do({ type: "pickSlot", slot: 5 })).toThrow();
    const g = pick(0).do({ type: "answerCorrect" }, { type: "backToPick" });
    expect(() => g.do({ type: "pickSlot", slot: 0 })).toThrow(/played/i);
  });

  it("wrong answer offers a steal with all clues shown", () => {
    const g = pick().do({ type: "answerWrong" });
    expect(live(g)).toMatchObject({ phase: "steal", shown: 4 });
    expect(live(g).timer?.startedAt).toBeNull();
  });

  it("timeout offers a steal with all clues shown", () => {
    const g = pick().tick(40_000).do({ type: "timerExpired" });
    expect(live(g)).toMatchObject({ phase: "steal", shown: 4 });
    expect(live(g).timer).toMatchObject({ startedAt: null, remainingMs: 0 });
  });

  it("steal scores 1 for the stealing team", () => {
    const g = pick().do({ type: "answerWrong" }, { type: "steal", teamId: "b", correct: true });
    expect(g.scores).toEqual({ a: 0, b: 1, c: 0 });
    expect(live(g)).toMatchObject({ phase: "done", outcome: "stolen", stealTeamId: "b" });
  });

  it("failed or declined steal scores nothing", () => {
    const g = pick().do({ type: "answerWrong" }, { type: "steal", teamId: "c", correct: false });
    expect(g.scores).toEqual(zero);
    expect(live(g)).toMatchObject({ phase: "done", outcome: "missed", stealTeamId: "c" });
    const h = pick().do({ type: "answerWrong" }, { type: "steal", teamId: null, correct: false });
    expect(live(h)).toMatchObject({ phase: "done", outcome: "missed", stealTeamId: null });
  });

  it("the steal can't go to the team that answered", () => {
    const g = pick().do({ type: "answerWrong" });
    expect(() => g.do({ type: "steal", teamId: "a", correct: true })).toThrow();
    expect(() => g.do({ type: "steal", teamId: "a", correct: false })).toThrow();
    expect(() => g.do({ type: "steal", teamId: "zzz", correct: true })).toThrow();
  });

  it("steal only from the steal phase; answers only in play", () => {
    expect(() => pick().do({ type: "steal", teamId: "b", correct: true })).toThrow();
    const g = pick().do({ type: "answerCorrect" });
    expect(() => g.do({ type: "answerCorrect" })).toThrow();
    expect(() => g.do({ type: "answerWrong" })).toThrow();
  });

  it("backToPick resets and advances the turn, wrapping around", () => {
    const g = pick(0).do({ type: "answerCorrect" }, { type: "backToPick" });
    expect(live(g)).toMatchObject({ phase: "pick", slot: null, teamId: null, shown: 0 });
    expect(g.state.turn).toBe(1);
    g.do({ type: "pickSlot", slot: 1 });
    expect(live(g).teamId).toBe("b");
    g.do({ type: "answerCorrect" }, { type: "backToPick" }, { type: "pickSlot", slot: 2 });
    expect(live(g).teamId).toBe("c");
    expect(() => g.do({ type: "backToPick" })).toThrow();
    g.do({ type: "answerCorrect" }, { type: "backToPick" });
    expect(g.state.turn).toBe(0);
  });
});

describe("sequences", () => {
  const live = (g: Game) => g.live as ConnectionLive;
  const pick = () => Game.inRound("sequence").do({ type: "pickSlot", slot: 0 });

  it("caps shown clues at three", () => {
    const g = pick().do({ type: "nextClue" }, { type: "nextClue" });
    expect(live(g).shown).toBe(3);
    expect(() => g.do({ type: "nextClue" })).toThrow();
  });

  it.each([
    [1, 5],
    [2, 3],
    [3, 2],
  ])("correct after %i clue(s) scores %i", (clues, pts) => {
    const g = pick();
    for (let i = 1; i < clues; i++) g.do({ type: "nextClue" });
    g.do({ type: "answerCorrect" });
    expect(g.scores.a).toBe(pts);
  });

  it("steal shows three clues and scores 1", () => {
    const g = pick().do({ type: "answerWrong" });
    expect(live(g)).toMatchObject({ phase: "steal", shown: 3 });
    g.do({ type: "steal", teamId: "c", correct: true });
    expect(g.scores.c).toBe(1);
  });
});

describe("wall", () => {
  const live = (g: Game) => g.live as WallLive;
  const pick = () => Game.inRound("wall").do({ type: "pickSlot", slot: 0 });
  const group = (gi: number): Action[] =>
    [0, 1, 2, 3].map((ci) => ({ type: "tapTile", tileId: `${gi}:${ci}` }));
  /** Three tiles from group `a` and one from group `b`. */
  const wrongOf = (a: number, b: number): Action[] =>
    [`${a}:0`, `${a}:1`, `${a}:2`, `${b}:0`].map((tileId) => ({ type: "tapTile", tileId }));
  const wrong = wrongOf(2, 3);

  it("pick shuffles 16 tiles and starts a 2:30 timer", () => {
    const g = pick();
    expect(live(g).phase).toBe("play");
    expect(live(g).order).toHaveLength(16);
    expect(new Set(live(g).order).size).toBe(16);
    expect(live(g).timer?.durationMs).toBe(150_000);
    expect(live(g).teamId).toBe("a");
  });

  it("tapping a selected tile deselects it", () => {
    const g = pick().do({ type: "tapTile", tileId: "0:0" }, { type: "tapTile", tileId: "1:1" });
    expect(live(g).selected).toEqual(["0:0", "1:1"]);
    g.do({ type: "tapTile", tileId: "0:0" });
    expect(live(g).selected).toEqual(["1:1"]);
    expect(() => g.do({ type: "tapTile", tileId: "9:9" })).toThrow();
  });

  it("unlimited guesses until two groups are found, then three lives", () => {
    const g = pick();
    for (let i = 0; i < 10; i++) g.do(...wrong);
    expect(live(g)).toMatchObject({ lives: null, wrongCount: 10, phase: "play", selected: [] });
    g.do(...group(2));
    expect(live(g)).toMatchObject({ found: [2], lives: null });
    g.do(...group(0));
    expect(live(g)).toMatchObject({ found: [2, 0], lives: 3 });
    g.do(...wrongOf(1, 3));
    expect(live(g).lives).toBe(2);
  });

  it("tiles of found groups are ignored", () => {
    const g = pick().do(...group(1));
    const s = g.state;
    g.do({ type: "tapTile", tileId: "1:0" });
    expect(g.state).toBe(s);
  });

  it("running out of lives ends play", () => {
    const g = pick().do(...group(0), ...group(1), ...wrong, ...wrong);
    expect(live(g)).toMatchObject({ lives: 1, phase: "play" });
    g.do(...wrong);
    expect(live(g)).toMatchObject({ lives: 0, phase: "connections" });
    expect(live(g).timer?.startedAt).toBeNull();
    expect(() => g.do({ type: "tapTile", tileId: "2:0" })).toThrow();
  });

  it("finding the third group solves the fourth", () => {
    const g = pick().do(...group(3), ...group(1), ...group(0));
    expect(live(g).found).toEqual([3, 1, 0, 2]);
    expect(live(g).phase).toBe("connections");
    expect(live(g).timer?.startedAt).toBeNull();
  });

  it("timeout ends play", () => {
    const g = pick()
      .do({ type: "tapTile", tileId: "0:0" })
      .tick(150_000)
      .do({ type: "timerExpired" });
    expect(live(g)).toMatchObject({ phase: "connections", selected: [] });
  });

  it("resolveWall ends play early", () => {
    const g = pick().do({ type: "resolveWall" });
    expect(live(g).phase).toBe("connections");
    expect(() => g.do({ type: "resolveWall" })).toThrow();
  });

  it("scores 1 per group plus 1 per connection", () => {
    const g = pick().do(
      ...group(0),
      ...group(1),
      { type: "resolveWall" },
      { type: "markConnection", group: 0, correct: true },
      { type: "markConnection", group: 2, correct: true },
      { type: "markConnection", group: 1, correct: false },
      { type: "finishWall" },
    );
    expect(g.scores.a).toBe(4);
    expect(live(g)).toMatchObject({ phase: "done", scored: true });
    expect(live(g).connections).toEqual([true, false, true, false]);
  });

  it("all groups and all connections earn the 2-point bonus (10 max)", () => {
    const marks: Action[] = [0, 1, 2, 3].map((group) => ({
      type: "markConnection",
      group,
      correct: true,
    }));
    const g = pick().do(...group(0), ...group(1), ...group(2), ...marks, { type: "finishWall" });
    expect(g.scores.a).toBe(10);
  });

  it("no bonus with all groups but a missed connection", () => {
    const marks: Action[] = [0, 1, 2].map((group) => ({
      type: "markConnection",
      group,
      correct: true,
    }));
    const g = pick().do(...group(0), ...group(1), ...group(2), ...marks, { type: "finishWall" });
    expect(g.scores.a).toBe(7);
  });

  it("no bonus with all connections but not all groups", () => {
    const marks: Action[] = [0, 1, 2, 3].map((group) => ({
      type: "markConnection",
      group,
      correct: true,
    }));
    const g = pick().do(...group(0), { type: "resolveWall" }, ...marks, { type: "finishWall" });
    expect(g.scores.a).toBe(5);
  });

  it("connections can only be marked after play", () => {
    expect(() => pick().do({ type: "markConnection", group: 0, correct: true })).toThrow();
    expect(() => pick().do({ type: "finishWall" })).toThrow();
  });

  it("ignores a stale timerExpired", () => {
    // Scheduled, then the timer was paused.
    const g = pick().tick(1000).do({ type: "pauseTimer" }).tick(200_000);
    let s = g.state;
    g.do({ type: "timerExpired" });
    expect(g.state).toBe(s);
    // Still time left on a running timer.
    g.do({ type: "resumeTimer" }).tick(1000);
    s = g.state;
    g.do({ type: "timerExpired" });
    expect(g.state).toBe(s);
    expect(live(g).phase).toBe("play");
    // Expiry after play has already ended.
    g.do({ type: "resolveWall" }).tick(500_000);
    s = g.state;
    g.do({ type: "timerExpired" });
    expect(g.state).toBe(s);
  });

  it("backToPick advances the turn", () => {
    const g = pick().do({ type: "resolveWall" }, { type: "finishWall" }, { type: "backToPick" });
    expect(g.state.turn).toBe(1);
    expect(live(g).phase).toBe("pick");
  });

  it("the same seed gives the same shuffle", () => {
    expect(live(pick()).order).toEqual(live(pick()).order);
  });
});

describe("missing vowels", () => {
  const live = (g: Game) => g.live as VowelsLive;
  const start = () => Game.inRound("vowels").do({ type: "vowelsStart" });

  it("start runs the timer once", () => {
    const g = start();
    expect(live(g)).toMatchObject({ started: true, clueIndex: -1 });
    expect(live(g).timer?.durationMs).toBe(180_000);
    expect(() => g.do({ type: "vowelsStart" })).toThrow();
  });

  it("no buzzing on the category title", () => {
    expect(() => start().do({ type: "vowelsBuzz", teamId: "a" })).toThrow();
  });

  it("+1 for a right answer", () => {
    const g = start().do(
      { type: "vowelsNext" },
      { type: "vowelsBuzz", teamId: "b" },
      { type: "vowelsJudge", correct: true },
    );
    expect(g.scores.b).toBe(1);
    expect(live(g)).toMatchObject({ revealed: true, correctTeamId: "b", buzzed: null });
    expect(() => g.do({ type: "vowelsBuzz", teamId: "c" })).toThrow();
  });

  it("−1 for a wrong answer, and that team can't buzz again", () => {
    const g = start().do(
      { type: "vowelsNext" },
      { type: "vowelsBuzz", teamId: "a" },
      { type: "vowelsJudge", correct: false },
    );
    expect(g.scores.a).toBe(-1);
    expect(live(g).wrong).toEqual(["a"]);
    expect(() => g.do({ type: "vowelsBuzz", teamId: "a" })).toThrow();
    g.do({ type: "vowelsBuzz", teamId: "c" }, { type: "vowelsJudge", correct: true });
    expect(g.scores).toEqual({ a: -1, b: 0, c: 1 });
  });

  it("judging needs a buzz; a buzz can be cleared", () => {
    const g = start().do({ type: "vowelsNext" });
    expect(() => g.do({ type: "vowelsJudge", correct: true })).toThrow();
    g.do({ type: "vowelsBuzz", teamId: "a" }, { type: "vowelsBuzz", teamId: null });
    expect(live(g).buzzed).toBeNull();
    expect(() => g.do({ type: "vowelsBuzz", teamId: "zzz" })).toThrow();
  });

  it("advances through clues and categories, then ends", () => {
    const g = start().do({ type: "vowelsNext" }, { type: "vowelsNext" });
    expect(live(g)).toMatchObject({ categoryIndex: 0, clueIndex: 1 });
    g.do({ type: "vowelsBuzz", teamId: "a" }, { type: "vowelsJudge", correct: false });
    g.do({ type: "vowelsNext" });
    expect(live(g)).toMatchObject({ categoryIndex: 1, clueIndex: -1, wrong: [], revealed: false });
    expect(g.state.played).toContain("v1");
    g.do({ type: "vowelsNext" });
    expect(live(g)).toMatchObject({ categoryIndex: 1, clueIndex: 0 });
    g.do({ type: "vowelsNext" });
    expect(live(g).ended).toBe(true);
    expect(live(g).timer?.startedAt).toBeNull();
    expect(g.state.played).toContain("v2");
    expect(() => g.do({ type: "vowelsNext" })).toThrow();
  });

  it("reveal shows the answer without scoring", () => {
    const g = start().do(
      { type: "vowelsNext" },
      { type: "vowelsBuzz", teamId: "a" },
      { type: "vowelsReveal" },
    );
    expect(live(g)).toMatchObject({ revealed: true, buzzed: null, correctTeamId: null });
    expect(g.scores).toEqual(zero);
  });

  it("timeout ends the round, but a pending buzz can still be judged", () => {
    const g = start()
      .do({ type: "vowelsNext" }, { type: "vowelsBuzz", teamId: "a" })
      .tick(180_000)
      .do({ type: "timerExpired" });
    expect(live(g).ended).toBe(true);
    expect(() => g.do({ type: "vowelsNext" })).toThrow();
    g.do({ type: "vowelsJudge", correct: true });
    expect(g.scores.a).toBe(1);
  });
});

describe("timers", () => {
  const live = (g: Game) => g.live as ConnectionLive;

  it("pause freezes remaining time and resume continues it", () => {
    const g = Game.inRound("connection").do({ type: "pickSlot", slot: 0 }).tick(10_000);
    expect(timerRemaining(live(g).timer, g.now)).toBe(30_000);
    g.do({ type: "pauseTimer" });
    expect(live(g).timer).toMatchObject({ startedAt: null, remainingMs: 30_000 });
    expect(timerDeadline(g.state)).toBeNull();
    g.tick(60_000);
    expect(timerRemaining(live(g).timer, g.now)).toBe(30_000);
    g.do({ type: "resumeTimer" });
    expect(timerDeadline(g.state)).toBe(g.now + 30_000);
    g.tick(29_000);
    expect(timerRemaining(live(g).timer, g.now)).toBe(1000);
    g.tick(1000).do({ type: "timerExpired" });
    expect(live(g).phase).toBe("steal");
  });

  it("no timer → error", () => {
    expect(() => Game.inRound("connection").do({ type: "pauseTimer" })).toThrow();
    expect(() => Game.inRound("standard").do({ type: "resumeTimer" })).toThrow();
  });

  it("a stopped timer can't be resumed after play ends", () => {
    const g = Game.inRound("connection").do(
      { type: "pickSlot", slot: 0 },
      { type: "answerCorrect" },
    );
    expect(() => g.do({ type: "resumeTimer" })).toThrow();
    const v = Game.inRound("vowels").do(
      { type: "vowelsStart" },
      { type: "vowelsNext" },
      { type: "vowelsNext" },
      { type: "vowelsNext" },
      { type: "vowelsNext" },
      { type: "vowelsNext" },
    );
    expect((v.live as VowelsLive).ended).toBe(true);
    expect(() => v.do({ type: "resumeTimer" })).toThrow();
  });

  it("round with timerSec null has no timer", () => {
    // Standard rounds default to no timer.
    expect((Game.inRound("standard").live as StandardLive & { timer?: unknown }).timer).toBe(
      undefined,
    );
  });
});

describe("match switching", () => {
  it("keeps an interrupted match's scores in results", () => {
    const g = Game.inRound("standard").do({ type: "adjustScore", teamId: "a", delta: 3 });
    const prevMatch = g.state.matchId!;
    g.do({ type: "startMatch", matchId: prevMatch });
    expect(g.state.results[prevMatch]).toMatchObject({ a: 3 });
    expect(g.state.scores.a).toBe(0);
  });
});
