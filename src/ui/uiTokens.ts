// 设计规范的间距、字号、圆角和控件阶梯，原生与 Web 共享。
export const font = {
  9: 9,
  10: 10,
  11: 11,
  12: 12,
  13: 13,
  14: 14,
  16: 16,
  18: 18,
  19: 19,
} as const;
export const space = {
  2: 2,
  4: 4,
  5: 5,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  20: 20,
} as const;
export const radius = {
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  14: 14,
  18: 18,
  full: 99,
} as const;
export const control = { 24: 24, 26: 26, 28: 28, 32: 32, 44: 44 } as const;
