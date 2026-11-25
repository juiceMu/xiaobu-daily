import { control, space } from './uiTokens';

const DESIGN_ROW_HEIGHT = 72;
const WEEKDAY_LINE_HEIGHT = 18;
const EXPLANATION_LINES = 3;
const LINE_HEIGHT = 18;

export function calendarRowHeight(availableHeight: number, rows: number) {
  // 标题栏、日历翻页、图例、说明、操作区及滚动容器内边距。
  const chrome =
    control[44] * 4 +
    WEEKDAY_LINE_HEIGHT +
    EXPLANATION_LINES * LINE_HEIGHT +
    space[12] * 5;
  return Math.max(
    control[44],
    Math.min(DESIGN_ROW_HEIGHT, Math.floor((availableHeight - chrome) / rows)),
  );
}
