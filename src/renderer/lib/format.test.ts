import { expect, test } from 'vitest';
import { noteSnapshot, relativeTime, titleFromBody } from './format';

test('titleFromBody uses Untitled when the body is empty', () => {
  expect(titleFromBody('')).toBe('Untitled');
});

test('titleFromBody strips heading marks', () => {
  expect(titleFromBody('# Hello world\n\nmore')).toBe('Hello world');
});

test('relativeTime says just now for a fresh timestamp', () => {
  expect(relativeTime(new Date().toISOString())).toBe('just now');
});

test('noteSnapshot stores the title taken from the body', () => {
  const snap = noteSnapshot({
    id: 'n1',
    body: '# Hello\n',
    notebookId: 'nb_inbox',
    tags: [],
    status: 'active',
    pinned: false,
  });
  expect(JSON.parse(snap).title).toBe('Hello');
});
