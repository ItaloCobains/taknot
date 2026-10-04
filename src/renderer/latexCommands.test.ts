import { expect, test } from 'vitest';
import { detectLatex, filterLatexCommands, inMathContext } from './latexCommands';

test('inMathContext is true inside inline math', () => {
  expect(inMathContext('$x', 2)).toBe(true);
});

test('detectLatex reads the command being typed', () => {
  const body = '$\\fr';
  expect(detectLatex(body, body.length)?.query).toBe('fr');
});

test('filterLatexCommands keeps a matching command', () => {
  expect(filterLatexCommands('frac').some((c) => c.id === 'frac')).toBe(true);
});
