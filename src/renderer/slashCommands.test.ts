import { expect, test } from 'vitest';
import { detectSlash, filterSlashCommands } from './slashCommands';

test('filterSlashCommands matches a heading keyword', () => {
  expect(filterSlashCommands('heading').some((c) => c.id === 'h1')).toBe(true);
});

test('detectSlash reads the query after the slash', () => {
  const body = 'hello /hea';
  expect(detectSlash(body, body.length)?.query).toBe('hea');
});
