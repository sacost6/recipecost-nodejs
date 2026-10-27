import { describe, expect, it } from 'vitest';
import { toTitleCase } from '../utils';

describe('toTitleCase', () => {
  it('normalizes the case of each word without trimming or collapsing whitespace', () => {
    expect(toTitleCase('  bREAD   FLOUR ')).toBe('  Bread   Flour ');
  });

  it('capitalizes words after punctuation and preserves punctuation', () => {
    expect(toTitleCase("brown-sugar, baker's yeast")).toBe(
      "Brown-Sugar, Baker'S Yeast",
    );
  });

  it('capitalizes Unicode word starts without splitting accented words', () => {
    expect(toTitleCase('CRÈME FRAÎCHE')).toBe('Crème Fraîche');
  });
});
