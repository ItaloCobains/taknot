import { expect, test, vi } from 'vitest';
import {
  HOTKEY_DEFS,
  HOTKEYS_STORAGE_KEY,
  findHotkeyConflict,
  formatHotkey,
  resetHotkeys,
  type HotkeyMap,
} from './hotkeys';

function defaultMap(): HotkeyMap {
  return Object.fromEntries(
    Object.entries(HOTKEY_DEFS).map(([id, def]) => [id, { ...def.binding }]),
  ) as HotkeyMap;
}

test('findHotkeyConflict names the shortcut that already uses the binding', () => {
  const map = defaultMap();
  expect(findHotkeyConflict(map, 'quickSearch', { ...HOTKEY_DEFS.newNote.binding })).toBe(
    'newNote',
  );
});

test('formatHotkey shows the mac modifier', () => {
  expect(formatHotkey({ key: 'n', mod: true }, true)).toBe('⌘N');
});

test('resetHotkeys restores the default new-note binding', () => {
  const store = new Map<string, string>([
    [HOTKEYS_STORAGE_KEY, JSON.stringify({ newNote: { key: 'z', mod: true } })],
  ]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  vi.stubGlobal('window', { dispatchEvent() {} });
  expect(resetHotkeys().newNote.key).toBe('n');
});
