import { expect, test } from 'vitest';
import { enableWikiLinks, renderMarkdown, toggleTaskAt } from './markdown';

test('toggleTaskAt checks the first task', () => {
  expect(toggleTaskAt('- [ ] ship\n- [ ] later', 0)).toBe('- [x] ship\n- [ ] later');
});

test('enableWikiLinks marks the note title', () => {
  expect(enableWikiLinks('See [[Target]]')).toContain('data-wiki-title="Target"');
});

test('renderMarkdown renders a wiki link as an anchor', () => {
  expect(renderMarkdown('See [[Target]]')).toContain('class="wiki-link"');
});
