export const TEMPLATES = [
  {
    id: 'blank',
    category: 'General',
    name: 'Blank note',
    body: '',
  },
  {
    id: 'reading-summary',
    category: 'Learning',
    name: 'Reading summary',
    body: `# Reading summary

## Source


## Key Points

-

## Notable Quotes

>

## My Take

`,
  },
  {
    id: 'bug-fix',
    category: 'Debugging',
    name: 'Bug fix',
    body: `# Bug fix

## Symptom


## Expected


## Actual


## Root cause


## Fix

`,
  },
  {
    id: 'crash-bug',
    category: 'Debugging',
    name: 'Crash bug',
    body: `# Crash bug

## Repro steps

1.
2.

## Stack / logs

\`\`\`

\`\`\`

## Hypothesis


## Fix

`,
  },
  {
    id: 'codebase-exploration',
    category: 'Learning',
    name: 'Codebase exploration',
    body: `# Codebase exploration

## Area


## What I found

-

## Open questions

-

## Next steps

-

`,
  },
  {
    id: 'brainstorm',
    category: 'Brainstorming',
    name: 'Brainstorm',
    body: `# Brainstorm

## Goal


## Ideas

-

## Keep

-

## Drop

-

`,
  },
  {
    id: 'plan',
    category: 'Planning',
    name: 'Plan',
    body: `# Plan

## Outcome


## Steps

- [ ]
- [ ]

## Risks


## Done when

`,
  },
];

export function groupTemplates(templates) {
  const map = new Map();
  for (const t of templates) {
    if (!map.has(t.category)) map.set(t.category, []);
    map.get(t.category).push(t);
  }
  return [...map.entries()];
}
