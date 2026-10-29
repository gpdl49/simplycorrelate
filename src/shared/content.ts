import { z } from "zod";

/** Quiz content: teams, the question bank and match configuration. Edited in admin. */

export const MediaSchema = z.object({
  kind: z.enum(["image", "audio"]),
  url: z.string().min(1),
});
export type Media = z.infer<typeof MediaSchema>;

export const ClueSchema = z.object({
  text: z.string().default(""),
  media: MediaSchema.optional(),
});
export type Clue = z.infer<typeof ClueSchema>;

export const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type Team = z.infer<typeof TeamSchema>;

const base = {
  id: z.string().min(1),
  /** Internal label shown only in admin and on the host remote. */
  label: z.string().default(""),
};

export const StandardQuestionSchema = z.object({
  ...base,
  type: z.literal("standard"),
  prompt: z.string().min(1),
  answer: z.string().min(1),
  media: MediaSchema.optional(),
  points: z.number().int().default(1),
  /** Points deducted for a wrong answer; 0 disables negative marking. */
  penalty: z.number().int().min(0).default(0),
});

/** Connections (4 clues → connection) and Sequences (3 clues → 4th; clue 4 is the answer). */
export const ConnectionQuestionSchema = z.object({
  ...base,
  type: z.enum(["connection", "sequence"]),
  clues: z.array(ClueSchema).length(4),
  connection: z.string().min(1),
  /** Host-only notes explaining each clue. */
  explanation: z.string().default(""),
});

export const WallGroupSchema = z.object({
  connection: z.string().min(1),
  clues: z.array(z.string().min(1)).length(4),
});

export const WallQuestionSchema = z.object({
  ...base,
  type: z.literal("wall"),
  groups: z.array(WallGroupSchema).length(4),
});

export const VowelsClueSchema = z.object({
  answer: z.string().min(1),
  /** Disguised form shown on screen; generated from `answer` when omitted. */
  puzzle: z.string().optional(),
});

export const VowelsQuestionSchema = z.object({
  ...base,
  type: z.literal("vowels"),
  category: z.string().min(1),
  clues: z.array(VowelsClueSchema).min(1).max(4),
});

export const BoardClueSchema = z.object({
  prompt: z.string().min(1),
  answer: z.string().min(1),
  media: MediaSchema.optional(),
  points: z.number().int().positive(),
});

/** One column of a Jeopardy-style board: a category with questions of increasing value. */
export const CategoryQuestionSchema = z.object({
  ...base,
  type: z.literal("category"),
  category: z.string().min(1),
  clues: z.array(BoardClueSchema).min(1).max(6),
});

export const QuestionSchema = z.discriminatedUnion("type", [
  StandardQuestionSchema,
  ConnectionQuestionSchema,
  WallQuestionSchema,
  VowelsQuestionSchema,
  CategoryQuestionSchema,
]);
export type Question = z.infer<typeof QuestionSchema>;
export type StandardQuestion = z.infer<typeof StandardQuestionSchema>;
export type ConnectionQuestion = z.infer<typeof ConnectionQuestionSchema>;
export type WallQuestion = z.infer<typeof WallQuestionSchema>;
export type VowelsQuestion = z.infer<typeof VowelsQuestionSchema>;
export type CategoryQuestion = z.infer<typeof CategoryQuestionSchema>;
export type BoardClue = z.infer<typeof BoardClueSchema>;

/** Default value of the nth (0-based) question in a board category. */
export function defaultBoardPoints(index: number): number {
  return (index + 1) * 10;
}
export type QuestionType = Question["type"];

export const ROUND_TYPES = [
  "standard",
  "connection",
  "sequence",
  "wall",
  "vowels",
  "board",
] as const;
export type RoundType = (typeof ROUND_TYPES)[number];

/** Which question type a round draws from. */
export const QUESTION_TYPE_FOR_ROUND: Record<RoundType, QuestionType> = {
  standard: "standard",
  connection: "connection",
  sequence: "connection",
  wall: "wall",
  vowels: "vowels",
  board: "category",
};

export const ROUND_TYPE_LABELS: Record<RoundType, string> = {
  standard: "Questions",
  connection: "Connections",
  sequence: "Sequences",
  wall: "Connecting Wall",
  vowels: "Missing Vowels",
  board: "Category Board",
};

export const DEFAULT_TIMER_SEC: Record<RoundType, number | null> = {
  standard: null,
  connection: 40,
  sequence: 40,
  wall: 150,
  vowels: 180,
  board: 30,
};

/** Board rounds: which wrong answers cost the question's value. */
export const NEGATIVE_MARKING = ["none", "steals", "all"] as const;
export type NegativeMarking = (typeof NEGATIVE_MARKING)[number];

export const RoundSchema = z.object({
  id: z.string().min(1),
  type: z.enum(ROUND_TYPES),
  title: z.string().default(""),
  questionIds: z.array(z.string()).default([]),
  /** Overrides DEFAULT_TIMER_SEC; null disables the timer. */
  timerSec: z.number().int().positive().nullable().optional(),
  /** Board rounds only; defaults to "steals". */
  negative: z.enum(NEGATIVE_MARKING).optional(),
});
export type Round = z.infer<typeof RoundSchema>;

export const MatchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  teamIds: z.array(z.string()).min(1).max(6),
  rounds: z.array(RoundSchema).default([]),
  locked: z.boolean().default(false),
});
export type Match = z.infer<typeof MatchSchema>;

export const QuizExportSchema = z.object({
  version: z.literal(1),
  teams: z.array(TeamSchema),
  questions: z.array(QuestionSchema),
  matches: z.array(MatchSchema),
});
export type QuizExport = z.infer<typeof QuizExportSchema>;

/** Egyptian hieroglyphs used to pick Connections/Sequences questions, in on-screen order. */
export const GLYPHS = [
  { id: "reeds", name: "Two Reeds", symbol: "𓇌" },
  { id: "lion", name: "Lion", symbol: "𓃭" },
  { id: "flax", name: "Twisted Flax", symbol: "𓎛" },
  { id: "viper", name: "Horned Viper", symbol: "𓆑" },
  { id: "water", name: "Water", symbol: "𓈗" },
  { id: "eye", name: "Eye of Horus", symbol: "𓂀" },
] as const;

export function roundTimerSec(round: Round): number | null {
  return round.timerSec === undefined ? DEFAULT_TIMER_SEC[round.type] : round.timerSec;
}

export function roundTitle(round: Round): string {
  return round.title || ROUND_TYPE_LABELS[round.type];
}
