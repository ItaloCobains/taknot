import { expect, test } from 'vitest';
import { findStatus } from './statuses';

test('findStatus falls back to Active for an unknown id', () => {
  expect(findStatus('nope').label).toBe('Active');
});

test('findStatus returns On Hold', () => {
  expect(findStatus('on_hold').label).toBe('On Hold');
});
