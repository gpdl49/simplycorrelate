/** Missing Vowels disguise: strip vowels and spaces, then regroup consonants with random spacing. */

const VOWELS = /[AEIOU]/g;

/** Small deterministic PRNG so a given seed always produces the same puzzle. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Uppercased answer with diacritics folded, keeping only letters, digits and spaces. */
export function normaliseAnswer(answer: string): string {
  return answer
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function disguise(answer: string, seed = 0): string {
  const letters = normaliseAnswer(answer).replace(VOWELS, "").replace(/ /g, "");
  if (letters.length <= 2) return letters;
  const rand = mulberry32(hash(answer) ^ seed);
  const groups: string[] = [];
  let i = 0;
  while (i < letters.length) {
    const remaining = letters.length - i;
    // Group sizes of 1–5, biased towards 2–4, never leaving a lone trailing letter.
    let size = 1 + Math.floor(rand() * 5);
    if (size === 1 && rand() < 0.6) size = 2 + Math.floor(rand() * 3);
    if (remaining - size === 1) size += 1;
    groups.push(letters.slice(i, i + size));
    i += size;
  }
  return groups.join(" ");
}

export function puzzleFor(clue: { answer: string; puzzle?: string | undefined }): string {
  return clue.puzzle?.trim() || disguise(clue.answer);
}
