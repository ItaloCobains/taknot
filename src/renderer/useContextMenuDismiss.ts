import { useEffect, type Dispatch, type SetStateAction } from 'react';

type MenuState = { x: number; y: number } | null;

type Args = {
  nbMenu: MenuState;
  tagMenu: MenuState;
  iconPicker: MenuState;
  movePicker: MenuState;
  setNbMenu: Dispatch<SetStateAction<any>>;
  setTagMenu: Dispatch<SetStateAction<any>>;
  setIconPicker: Dispatch<SetStateAction<any>>;
  setMovePicker: Dispatch<SetStateAction<any>>;
};

/** Close notebook/tag/icon/move menus on outside click or scroll. */
export function useContextMenuDismiss({
  nbMenu,
  tagMenu,
  iconPicker,
  movePicker,
  setNbMenu,
  setTagMenu,
  setIconPicker,
  setMovePicker,
}: Args) {
  useEffect(() => {
    if (!nbMenu && !tagMenu && !iconPicker && !movePicker) return undefined;
    const close = (e: Event) => {
      const target = e.target as Element | null;
      if (target?.closest?.('.context-menu')) return;
      setNbMenu(null);
      setTagMenu(null);
      setIconPicker(null);
      setMovePicker(null);
    };
    const t = window.setTimeout(() => {
      window.addEventListener('mousedown', close);
      window.addEventListener('scroll', close, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [
    nbMenu,
    tagMenu,
    iconPicker,
    movePicker,
    setNbMenu,
    setTagMenu,
    setIconPicker,
    setMovePicker,
  ]);
}
