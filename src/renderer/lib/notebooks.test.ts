import { expect, test } from 'vitest';
import { descendantIds, flattenNotebooks } from './notebooks';

const tree = [
  { id: 'parent', parentId: null },
  { id: 'child', parentId: 'parent' },
  { id: 'grand', parentId: 'child' },
];

test('descendantIds includes a grandchild', () => {
  expect([...descendantIds(tree, 'parent')].sort()).toEqual(['child', 'grand']);
});

test('flattenNotebooks nests the grandchild under its parent', () => {
  const flat = flattenNotebooks(tree);
  expect(flat.find((n) => n.id === 'grand')?.depth).toBe(2);
});
