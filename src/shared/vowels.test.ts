import { describe, expect, it } from "vitest";
import { disguise, normaliseAnswer, puzzleFor } from "./vowels";

const ANSWERS = [
  "Central Processing Unit",
  "Ada Lovelace",
  "Rabindranath Tagore",
  "Stack Overflow",
  "Hello, World!",
  "Café Coffee Day",
  "R2-D2",
  "Tom & Jerry",
  "Linux",
];
const consonants = (s: string) => normaliseAnswer(s).replace(/[AEIOU ]/g, "");

describe("missing vowels disguise", () => {
  it.each(ANSWERS)("%s: no vowels, same consonants in order", (answer) => {
    for (const seed of [0, 1, 42, 9999]) {
      const p = disguise(answer, seed);
      expect(p).not.toMatch(/[AEIOUaeiou]/);
      expect(p.replace(/ /g, "")).toBe(consonants(answer));
      expect(p).toBe(p.toUpperCase());
      expect(p).not.toMatch(/^ | $| {2}/);
    }
  });

  it("is deterministic per seed", () => {
    for (const a of ANSWERS) expect(disguise(a, 7)).toBe(disguise(a, 7));
    const variants = new Set(
      [0, 1, 2, 3, 4, 5, 6, 7].map((s) => disguise("Rabindranath Tagore", s)),
    );
    expect(variants.size).toBeGreaterThan(1);
  });

  it("never leaves a lone trailing letter", () => {
    for (let seed = 0; seed < 200; seed++) {
      const groups = disguise("Central Processing Unit", seed).split(" ");
      expect(groups.at(-1)!.length).toBeGreaterThan(1);
    }
  });

  it("folds diacritics and ampersands", () => {
    expect(normaliseAnswer("Café & Crème")).toBe("CAFE AND CREME");
  });

  it("puzzleFor prefers a manual override", () => {
    expect(puzzleFor({ answer: "Linux", puzzle: " LN X " })).toBe("LN X");
    expect(puzzleFor({ answer: "Linux" })).toBe(disguise("Linux"));
    expect(puzzleFor({ answer: "Linux", puzzle: "  " })).toBe(disguise("Linux"));
  });
});
