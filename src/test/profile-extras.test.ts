import { describe, expect, it } from "vitest";

import { cleanPrompts, MAX_PHOTOS, moveItem, randomQuestion } from "@/lib/profile-extras";

describe("profile prompts", () => {
  it("keeps at most 3 answered prompts", () => {
    const slots = ["a", "b", "c", "d"].map((q) => ({ question: q, answer: "yes" }));
    expect(cleanPrompts(slots)).toHaveLength(3);
  });

  it("drops prompts without an answer", () => {
    expect(
      cleanPrompts([
        { question: "a", answer: "   " },
        { question: "b", answer: "hi" },
      ]),
    ).toEqual([{ question: "b", answer: "hi" }]);
  });

  it("caps answers at 200 characters", () => {
    expect(cleanPrompts([{ question: "a", answer: "x".repeat(250) }])[0]?.answer).toHaveLength(200);
  });

  it("never suggests a question already in use", () => {
    const first = randomQuestion([], () => 0);
    expect(randomQuestion([first], () => 0)).not.toBe(first);
  });
});

describe("profile photos", () => {
  it("allows up to 6 photos", () => {
    expect(MAX_PHOTOS).toBe(6);
  });

  it("making a photo the main one moves it to the front", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
});
