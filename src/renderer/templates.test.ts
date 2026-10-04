import { expect, test } from 'vitest';
import { BUILTIN_TEMPLATES, groupTemplates } from './templates';

test('built-in templates are marked builtin', () => {
  expect(BUILTIN_TEMPLATES.every((t) => t.builtin)).toBe(true);
});

test('groupTemplates keeps Blank note in General', () => {
  const groups = groupTemplates(BUILTIN_TEMPLATES);
  const general = groups.find(([name]) => name === 'General')?.[1] ?? [];
  expect(general.some((t) => t.name === 'Blank note')).toBe(true);
});
