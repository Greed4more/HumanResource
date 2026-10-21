export const MAX_PHOTOS = 6;
export const MAX_PROMPTS = 3;
export const MAX_ANSWER = 200;

export type Prompt = { question: string; answer: string };

/** Questions students pick from and answer on their profile, Hinge-style. */
export const PROMPT_QUESTIONS = [
  "My ideal study break looks like…",
  "The way to win me over is…",
  "A green flag I look for…",
  "My most controversial opinion…",
  "I’m weirdly good at…",
  "The best spot on campus is…",
  "Two truths and a lie…",
  "My go-to canteen order…",
  "I’ll fall for you if…",
  "A perfect Sunday for me…",
  "The song I have on repeat…",
  "I geek out on…",
  "Let’s debate this topic…",
  "My simple pleasures…",
  "Typical weekend plan…",
  "I won’t shut up about…",
  "Dating me is like…",
  "First date idea…",
  "The last thing that made me laugh out loud…",
  "Something I’ll never skip class for…",
] as const;

/** A random question that isn't already used in another slot. */
export function randomQuestion(exclude: string[], rand: () => number = Math.random): string {
  const pool = PROMPT_QUESTIONS.filter((q) => !exclude.includes(q));
  const list = pool.length ? pool : PROMPT_QUESTIONS;
  return list[Math.floor(rand() * list.length)] ?? PROMPT_QUESTIONS[0];
}

/** Keep only answered prompts, trimmed, with no repeated questions, capped at MAX_PROMPTS. */
export function cleanPrompts(slots: Prompt[]): Prompt[] {
  const seen = new Set<string>();
  const out: Prompt[] = [];
  for (const s of slots) {
    const question = s.question.trim();
    const answer = s.answer.trim().slice(0, MAX_ANSWER);
    if (!question || !answer || seen.has(question)) continue;
    seen.add(question);
    out.push({ question, answer });
    if (out.length === MAX_PROMPTS) break;
  }
  return out;
}

/** Read prompts stored on a profile, tolerating anything malformed. */
export function readPrompts(value: unknown): Prompt[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) =>
    v &&
    typeof v === "object" &&
    typeof (v as Prompt).question === "string" &&
    typeof (v as Prompt).answer === "string"
      ? [{ question: (v as Prompt).question, answer: (v as Prompt).answer }]
      : [],
  );
}

/** Move one item to a new position (used to reorder photos; index 0 is the main photo). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}
