import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QUESTION_TYPE_FOR_ROUND, QuizExportSchema } from "./content";

const raw = JSON.parse(
  readFileSync(new URL("../../fixtures/demo-quiz.json", import.meta.url), "utf8"),
) as unknown;

describe("fixtures/demo-quiz.json", () => {
  const quiz = QuizExportSchema.parse(raw);
  const questions = new Map(quiz.questions.map((q) => [q.id, q]));

  it("is a valid export with 6 teams and the required content", () => {
    expect(quiz.teams).toHaveLength(6);
    const count = (t: string) => quiz.questions.filter((q) => q.type === t).length;
    expect(count("connection")).toBeGreaterThanOrEqual(6);
    expect(count("sequence")).toBeGreaterThanOrEqual(6);
    expect(count("wall")).toBeGreaterThanOrEqual(2);
    expect(count("standard")).toBeGreaterThanOrEqual(8);
    const vowels = quiz.questions.filter((q) => q.type === "vowels");
    expect(vowels).toHaveLength(3);
    for (const v of vowels) expect(v.clues).toHaveLength(4);
  });

  it("has unique ids and round questions of the right type", () => {
    expect(questions.size).toBe(quiz.questions.length);
    const teamIds = new Set(quiz.teams.map((t) => t.id));
    for (const m of quiz.matches) {
      for (const t of m.teamIds) expect(teamIds.has(t)).toBe(true);
      for (const r of m.rounds) {
        expect(r.questionIds.length).toBeLessThanOrEqual(6);
        for (const id of r.questionIds) {
          const q = questions.get(id);
          expect(q, id).toBeDefined();
          const want = QUESTION_TYPE_FOR_ROUND[r.type];
          expect(q!.type === want || (want === "connection" && q!.type === "sequence")).toBe(true);
          if (r.type === "sequence") expect(q!.type).toBe("sequence");
        }
      }
    }
  });

  it("the two heats share no questions", () => {
    const used = (id: string) =>
      new Set(quiz.matches.find((m) => m.id === id)!.rounds.flatMap((r) => r.questionIds));
    const a = used("demo-heat-1");
    const b = used("demo-heat-2");
    expect([...a].filter((x) => b.has(x))).toEqual([]);
  });

  it("walls have 16 distinct tiles", () => {
    for (const q of quiz.questions) {
      if (q.type !== "wall") continue;
      const tiles = q.groups.flatMap((g) => g.clues.map((c) => c.toLowerCase()));
      expect(new Set(tiles).size).toBe(16);
    }
  });
});
