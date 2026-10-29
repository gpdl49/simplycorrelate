import type { Match, Question, Round, Team } from "./content";
import { reduce } from "./engine";
import { type Action, type Content, type GameState, initialState } from "./game";

/** Test helpers: a small quiz and a dispatcher with a controllable clock. Not used at runtime. */

export const TEAMS: Team[] = [
  { id: "a", name: "Alpha", color: "#2977F5" },
  { id: "b", name: "Bravo", color: "#E8484E" },
  { id: "c", name: "Charlie", color: "#1FB58F" },
];

export const QUESTIONS: Question[] = [
  {
    id: "s1",
    label: "",
    type: "standard",
    prompt: "What does CPU stand for?",
    answer: "Central Processing Unit",
    points: 2,
    penalty: 1,
  },
  {
    id: "s2",
    label: "",
    type: "standard",
    prompt: "Who wrote the first published algorithm?",
    answer: "Ada Lovelace",
    points: 1,
    penalty: 0,
  },
  ...[1, 2, 3].map(
    (n): Question => ({
      id: `c${n}`,
      label: `conn ${n}`,
      type: "connection",
      clues: ["Python", "Ruby", "Java", "Rust"].map((t) => ({ text: `${t}${n}` })),
      connection: `Programming languages ${n}`,
      explanation: "Secret explanation",
    }),
  ),
  {
    id: "q1",
    label: "",
    type: "sequence",
    clues: [{ text: "Kilobyte" }, { text: "Megabyte" }, { text: "Gigabyte" }, { text: "Terabyte" }],
    connection: "Powers of 1024 bytes",
    explanation: "",
  },
  {
    id: "w1",
    label: "wall one",
    type: "wall",
    groups: [
      { connection: "Planets", clues: ["Mercury", "Venus", "Mars", "Saturn"] },
      { connection: "Linux distros", clues: ["Ubuntu", "Fedora", "Arch", "Mint"] },
      { connection: "Chess pieces", clues: ["Rook", "Bishop", "Knight", "Pawn"] },
      { connection: "Logic gates", clues: ["NAND", "XOR", "NOR", "AND"] },
    ],
  },
  {
    id: "v1",
    label: "",
    type: "vowels",
    category: "Search engines",
    clues: [{ answer: "Google" }, { answer: "Bing" }],
  },
  {
    id: "v2",
    label: "",
    type: "vowels",
    category: "Web browsers",
    clues: [{ answer: "Firefox" }],
  },
  ...["Hardware", "Internet"].map(
    (name, n): Question => ({
      id: `b${n + 1}`,
      label: "",
      type: "category",
      category: name,
      clues: [10, 20].map((points, i) => ({
        prompt: `${name} question ${i + 1}`,
        answer: `${name} answer ${i + 1}`,
        points,
      })),
    }),
  ),
];

const rounds: Round[] = [
  { id: "r-std", type: "standard", title: "", questionIds: ["s1", "s2"] },
  { id: "r-con", type: "connection", title: "", questionIds: ["c1", "c2", "c3"] },
  { id: "r-seq", type: "sequence", title: "", questionIds: ["q1"] },
  { id: "r-wall", type: "wall", title: "", questionIds: ["w1"] },
  { id: "r-vow", type: "vowels", title: "", questionIds: ["v1", "v2"] },
  { id: "r-board", type: "board", title: "", questionIds: ["b1", "b2"] },
  { id: "r-board-all", type: "board", title: "", questionIds: ["b1", "b2"], negative: "all" },
];
export const ROUND = {
  standard: 0,
  connection: 1,
  sequence: 2,
  wall: 3,
  vowels: 4,
  board: 5,
  boardAll: 6,
} as const;

export const MATCH: Match = {
  id: "m1",
  name: "Heat 1",
  teamIds: ["a", "b", "c"],
  rounds,
  locked: false,
};

export const content: Content = {
  teams: new Map(TEAMS.map((t) => [t.id, t])),
  questions: new Map(QUESTIONS.map((q) => [q.id, q])),
  matches: new Map([[MATCH.id, MATCH]]),
};

export class Game {
  state: GameState = initialState;
  now = 1_000_000;
  seed = 12345;

  do(...actions: Action[]): this {
    for (const a of actions) {
      this.state = reduce(this.state, a, { content, now: this.now, seed: this.seed });
    }
    return this;
  }

  tick(ms: number): this {
    this.now += ms;
    return this;
  }

  get live() {
    return this.state.live!;
  }

  get scores() {
    return this.state.scores;
  }

  /** Started match, in the given round. */
  static inRound(round: keyof typeof ROUND): Game {
    return new Game().do(
      { type: "startMatch", matchId: MATCH.id },
      { type: "goToRound", index: ROUND[round] },
    );
  }
}
