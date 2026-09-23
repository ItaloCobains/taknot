export type HotkeyBinding = {
  key: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export type HotkeyDef = {
  label: string;
  binding: HotkeyBinding;
};

export type HotkeyId = keyof typeof HOTKEY_DEFS;

export type HotkeyMap = Record<HotkeyId, HotkeyBinding>;

export const HOTKEYS_STORAGE_KEY = 'taknot.hotkeys';

export const HOTKEY_DEFS = {
  newNote: {
    label: 'New note',
    binding: { key: 'n', mod: true },
  },
  toggleSidebar: {
    label: 'Toggle sidebar',
    binding: { key: '/', mod: true },
  },
  quickSearch: {
    label: 'Quick search',
    binding: { key: 'k', mod: true },
  },
  saveNote: {
    label: 'Save note',
    binding: { key: 's', mod: true },
  },
  togglePin: {
    label: 'Pin / unpin note',
    binding: { key: 'p', mod: true },
  },
  toggleFocus: {
    label: 'Focus mode',
    binding: { key: 'e', mod: true },
  },
  openSettings: {
    label: 'Settings',
    binding: { key: ',', mod: true },
  },
  collapseSidebar: {
    label: 'Collapse sidebar',
    binding: { key: 'ArrowLeft', mod: true, shift: true },
  },
  expandSidebar: {
    label: 'Expand sidebar',
    binding: { key: 'ArrowRight', mod: true, shift: true },
  },
  historyBack: {
    label: 'Back in note history',
    binding: { key: 'ArrowLeft', mod: true, alt: true },
  },
  historyForward: {
    label: 'Forward in note history',
    binding: { key: 'ArrowRight', mod: true, alt: true },
  },
  bold: {
    label: 'Bold',
    binding: { key: 'b', mod: true },
  },
  italic: {
    label: 'Italic',
    binding: { key: 'i', mod: true },
  },
  closeNote: {
    label: 'Close current note',
    binding: { key: 'w', mod: true },
  },
  focusListSearch: {
    label: 'Focus note list search',
    binding: { key: 'l', mod: true },
  },
  statusActive: {
    label: 'Status: Active',
    binding: { key: '1', mod: true },
  },
  statusOnHold: {
    label: 'Status: On Hold',
    binding: { key: '2', mod: true },
  },
  statusCompleted: {
    label: 'Status: Completed',
    binding: { key: '3', mod: true },
  },
  statusDropped: {
    label: 'Status: Dropped',
    binding: { key: '4', mod: true },
  },
} as const satisfies Record<string, HotkeyDef>;

export const HOTKEY_ORDER = Object.keys(HOTKEY_DEFS) as HotkeyId[];

function normalizeBinding(
  raw: Partial<HotkeyBinding> | null | undefined,
  fallback: HotkeyBinding,
): HotkeyBinding {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const key = String(raw.key || fallback.key);
  return {
    key,
    mod: Boolean(raw.mod ?? fallback.mod),
    shift: Boolean(raw.shift ?? fallback.shift),
    alt: Boolean(raw.alt ?? fallback.alt),
  };
}

export function loadHotkeys(): HotkeyMap {
  const out = {} as HotkeyMap;
  for (const id of HOTKEY_ORDER) {
    out[id] = { ...HOTKEY_DEFS[id].binding };
  }
  try {
    const raw = localStorage.getItem(HOTKEYS_STORAGE_KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as Record<string, Partial<HotkeyBinding>>;
    if (!parsed || typeof parsed !== 'object') return out;
    for (const id of HOTKEY_ORDER) {
      if (parsed[id]) {
        out[id] = normalizeBinding(parsed[id], HOTKEY_DEFS[id].binding);
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

export function saveHotkeys(map: Partial<HotkeyMap>): HotkeyMap {
  const payload = {} as HotkeyMap;
  for (const id of HOTKEY_ORDER) {
    payload[id] = normalizeBinding(map[id], HOTKEY_DEFS[id].binding);
  }
  localStorage.setItem(HOTKEYS_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent('taknot:hotkeys-changed'));
  return payload;
}

export function resetHotkeys(): HotkeyMap {
  localStorage.removeItem(HOTKEYS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('taknot:hotkeys-changed'));
  return loadHotkeys();
}

export function isMacPlatform(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')
  );
}

const KEY_DISPLAY: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  ' ': 'Space',
  Enter: '⏎',
  Backspace: '⌫',
};

function displayKey(key: string): string {
  if (KEY_DISPLAY[key]) return KEY_DISPLAY[key];
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function formatHotkey(
  binding: HotkeyBinding | null | undefined,
  mac = isMacPlatform(),
): string {
  if (!binding?.key) return '—';
  const parts: string[] = [];
  if (binding.mod) parts.push(mac ? '⌘' : 'Ctrl');
  if (binding.alt) parts.push(mac ? '⌥' : 'Alt');
  if (binding.shift) parts.push(mac ? '⇧' : 'Shift');
  parts.push(displayKey(binding.key));
  return parts.join(mac ? '' : '+');
}

export function eventMatchesHotkey(
  e: KeyboardEvent,
  binding: HotkeyBinding | null | undefined,
): boolean {
  if (!binding?.key) return false;
  const mod = e.metaKey || e.ctrlKey;
  if (Boolean(binding.mod) !== mod) return false;
  if (Boolean(binding.shift) !== e.shiftKey) return false;
  if (Boolean(binding.alt) !== e.altKey) return false;

  const want = binding.key;
  if (want === ',' || want === '/') {
    return e.key === want;
  }
  if (want.startsWith('Arrow') || want === 'Escape' || want === 'Enter') {
    return e.key === want;
  }
  return e.key.toLowerCase() === want.toLowerCase();
}

export function bindingFromEvent(e: KeyboardEvent): HotkeyBinding | null {
  const mod = e.metaKey || e.ctrlKey;
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return null;
  return {
    key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
    mod,
    shift: e.shiftKey,
    alt: e.altKey,
  };
}

export function findHotkeyConflict(
  map: HotkeyMap,
  candidateId: HotkeyId,
  candidate: HotkeyBinding,
): HotkeyId | null {
  for (const id of HOTKEY_ORDER) {
    if (id === candidateId) continue;
    const other = map[id];
    if (!other) continue;
    if (
      other.key === candidate.key &&
      Boolean(other.mod) === Boolean(candidate.mod) &&
      Boolean(other.shift) === Boolean(candidate.shift) &&
      Boolean(other.alt) === Boolean(candidate.alt)
    ) {
      return id;
    }
  }
  return null;
}
