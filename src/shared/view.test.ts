import { describe, expect, it } from "vitest";
import type { ConnectionQuestion, StandardQuestion, VowelsQuestion, WallQuestion } from "./content";
import type { Action } from "./game";
import { content, Game, QUESTIONS } from "./testkit";
import { buildView, type WallView } from "./view";

const display = (g: Game) => JSON.stringify(buildView(g.state, content, "display", g.now));
const host = (g: Game) => JSON.stringify(buildView(g.state, content, "host", g.now));
type ByType = {
  standard: StandardQuestion;
  connection: ConnectionQuestion;
  sequence: ConnectionQuestion;
  wall: WallQuestion;
  vowels: VowelsQuestion;
};
const q = <T extends keyof ByType>(id: string, _type: T) =>
  QUESTIONS.find((x) => x.id === id) as ByType[T];

describe("view redaction", () => {
  it("standard: answer hidden until revealed", () => {
    const g = Game.inRound("standard");
    const s1 = q("s1", "standard");
    expect(display(g)).not.toContain(s1.answer);
    expect(host(g)).toContain(s1.answer);
    g.do({ type: "standardReveal", revealed: true });
    expect(display(g)).toContain(s1.answer);
  });

  it("connections: unseen clues, connection and explanation hidden until done", () => {
    const c1 = q("c1", "connection");
    const g = Game.inRound("connection");
    expect(host(g)).toContain("conn 1"); // host sees slot labels
    expect(display(g)).not.toContain("conn 1");
    g.do({ type: "pickSlot", slot: 0 });
    const d = display(g);
    expect(d).toContain(c1.clues[0]!.text);
    for (const clue of c1.clues.slice(1)) expect(d).not.toContain(clue.text);
    expect(d).not.toContain(c1.connection);
    expect(d).not.toContain(c1.explanation);
    const h = host(g);
    for (const clue of c1.clues) expect(h).toContain(clue.text);
    expect(h).toContain(c1.connection);
    expect(h).toContain(c1.explanation);

    g.do({ type: "answerWrong" });
    for (const clue of c1.clues) expect(display(g)).toContain(clue.text);
    expect(display(g)).not.toContain(c1.connection);
    g.do({ type: "steal", teamId: "b", correct: false });
    expect(display(g)).toContain(c1.connection);
    expect(display(g)).not.toContain(c1.explanation);
  });

  it("sequences: the fourth clue stays hidden through the steal", () => {
    const seq = q("q1", "sequence");
    const g = Game.inRound("sequence").do({ type: "pickSlot", slot: 0 }, { type: "answerWrong" });
    expect(display(g)).toContain(seq.clues[2]!.text);
    expect(display(g)).not.toContain(seq.clues[3]!.text);
    expect(display(g)).not.toContain(seq.connection);
    expect(host(g)).toContain(seq.clues[3]!.text);
    g.do({ type: "steal", teamId: null, correct: false });
    expect(display(g)).toContain(seq.clues[3]!.text);
    expect(display(g)).toContain(seq.connection);
  });

  it("wall: groupings and connections hidden during play", () => {
    const w1 = q("w1", "wall");
    const g = Game.inRound("wall").do({ type: "pickSlot", slot: 0 });
    const d = display(g);
    for (const grp of w1.groups) {
      expect(d).not.toContain(grp.connection);
      for (const clue of grp.clues) expect(d).toContain(clue); // tiles are visible
    }
    // Tile ids must not encode the group on the display.
    expect(d).not.toMatch(/"\d:\d"/);
    const dv = JSON.parse(d).round as WallView;
    expect(dv.tiles.every((t) => t.group === null)).toBe(true);
    const h = host(g);
    for (const grp of w1.groups) expect(h).toContain(grp.connection);
    const hv = JSON.parse(h).round as WallView;
    expect(hv.tiles.every((t) => t.group !== null)).toBe(true);

    // Found groups are revealed; others stay hidden.
    const taps: Action[] = [0, 1, 2, 3].map((ci) => ({ type: "tapTile", tileId: `1:${ci}` }));
    g.do(...taps, { type: "tapTile", tileId: "0:0" });
    const dv2 = JSON.parse(display(g)).round as WallView;
    expect(dv2.tiles.filter((t) => t.group === 1)).toHaveLength(4);
    expect(dv2.tiles.filter((t) => t.group === null)).toHaveLength(12);
    expect(dv2.selected).toHaveLength(1);
    expect(dv2.tiles.map((t) => t.id)).toContain(dv2.selected[0]);
    expect(display(g)).not.toContain(w1.groups[1]!.connection);

    g.do({ type: "resolveWall" });
    for (const grp of w1.groups) expect(display(g)).toContain(grp.connection);
  });

  it("vowels: answer hidden until revealed, next category host-only", () => {
    const v1 = q("v1", "vowels");
    const v2 = q("v2", "vowels");
    const g = Game.inRound("vowels").do({ type: "vowelsStart" }, { type: "vowelsNext" });
    const answer = v1.clues[0]!.answer;
    expect(display(g)).not.toContain(answer);
    expect(display(g).toUpperCase()).not.toContain(answer.toUpperCase());
    expect(display(g)).not.toContain(v2.category);
    expect(host(g)).toContain(answer);
    expect(host(g)).toContain(v2.category);
    g.do({ type: "vowelsReveal" });
    expect(display(g)).toContain(answer);
  });

  it("host gets the match list; display doesn't", () => {
    const g = Game.inRound("standard");
    expect(buildView(g.state, content, "host", g.now).matches).toHaveLength(1);
    expect(buildView(g.state, content, "display", g.now).matches).toBeUndefined();
  });
});
