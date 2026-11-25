const TASK_MENU_GAP = 8;
export const TASK_MENU_ROW_HEIGHT = 44;
const TASK_MENU_DIVIDER_HEIGHT = 1;
const TASK_MENU_ROW_COUNT = 4;
const TASK_MENU_HEIGHT =
  TASK_MENU_ROW_HEIGHT * TASK_MENU_ROW_COUNT + TASK_MENU_DIVIDER_HEIGHT;

export function taskMenuLayout(
  anchorTop: number,
  windowHeight: number,
  safeTop: number,
  navigationHeight: number,
) {
  const topInset = safeTop + TASK_MENU_GAP;
  const bottom = windowHeight - navigationHeight - TASK_MENU_GAP;
  const height = Math.min(TASK_MENU_HEIGHT, Math.max(0, bottom - topInset));
  return {
    height,
    top: Math.max(topInset, Math.min(anchorTop, bottom) - height),
  };
}

export function bottomNavigationHeight(fontScale: number, bottomInset: number) {
  return 64 + Math.max(0, Math.min(fontScale, 1.5) - 1) * 32 + bottomInset + 12;
}
