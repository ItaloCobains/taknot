import { useEffect } from 'react';

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
}) {
  useEffect(() => {
    if (!nbMenu && !tagMenu && !iconPicker && !movePicker) return undefined;
    function close(e) {
      if (e.target?.closest?.('.context-menu')) return;
      setNbMenu(null);
      setTagMenu(null);
      setIconPicker(null);
      setMovePicker(null);
    }
    const t = setTimeout(() => {
      window.addEventListener('mousedown', close);
      window.addEventListener('scroll', close, true);
    }, 0);
    return () => {
      clearTimeout(t);
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
