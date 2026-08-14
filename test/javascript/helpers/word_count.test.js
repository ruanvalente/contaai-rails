import { describe, expect, test } from "vitest";
import { calculateWordCount, calculateCharacterCount } from "../../../app/javascript/helpers/word_count";

describe("calculateWordCount", () => {
  test("counts words separated by spaces", () => {
    expect(calculateWordCount("Hello world")).toBe(2);
  });

  test("counts line breaks and multiple spaces as a single word separator", () => {
    expect(calculateWordCount("linha um\n\nlinha dois   com  espaço")).toBe(6);
  });

  test("returns 0 for empty text", () => {
    expect(calculateWordCount("")).toBe(0);
  });

  test("returns 0 for null", () => {
    expect(calculateWordCount(null)).toBe(0);
    expect(calculateWordCount(undefined)).toBe(0);
  });

  test("ignores whitespace at the edges", () => {
    expect(calculateWordCount("   palavra   ")).toBe(1);
  });
});

describe("calculateCharacterCount", () => {
  test("counts characters including spaces", () => {
    expect(calculateCharacterCount("Olá mundo")).toBe(9);
  });

  test("returns 0 for an empty string", () => {
    expect(calculateCharacterCount("")).toBe(0);
  });

  test("returns 0 for null", () => {
    expect(calculateCharacterCount(null)).toBe(0);
  });
});
