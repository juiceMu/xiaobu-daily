export const DEFAULT_THEME_ID = 'warm';
export type ThemeId = 'warm' | 'mint' | 'lavender' | 'forest' | 'sea' | 'iris';

// 旧版默认值保持不变；任务色键及操作语义色不随装饰主题改变。
export const defaultColors = {
  background: '#FFFCF8',
  surface: '#FFFFFF',
  field: '#FCF7EE',
  ink: '#36332F',
  muted: '#6A645C',
  brandFill: '#DCCFBE',
  onBrand: '#514B44',
  primary: '#625B53',
  primaryContainer: '#F2ECE2',
  primaryAccent: '#F2ECE2',
  green: '#EAF7EE',
  peach: '#FFF0E5',
  blue: '#E8F1FA',
  purple: '#F2ECFF',
  border: '#E8DCC8',
  danger: '#A3373C',
  save: '#D9F1E5',
  onSave: '#286047',
  reward: '#EEE5FF',
  onReward: '#65448F',
  archive: '#FFE6CF',
  onArchive: '#80502C',
  selectedIcon: '#65448F',
  usedBadge: '#DFEDE5',
  onUsedBadge: '#355C48',
  expiredBadge: '#F4E3E0',
  onExpiredBadge: '#89443F',
};
export type AppColors = { [K in keyof typeof defaultColors]: string };
export const utilityColors = {
  onSolid: '#FFFFFF',
  qrInk: '#000000',
  qrSurface: '#FFFFFF',
  cameraSurface: '#111111',
  timelineRule: '#B7C0B8',
} as const;

function blendHex(base: string, accent: string): string {
  const baseValue = Number.parseInt(base.slice(1), 16);
  const accentValue = Number.parseInt(accent.slice(1), 16);
  const channels = [16, 8, 0].map((shift) => {
    const from = (baseValue >> shift) & 255;
    const to = (accentValue >> shift) & 255;
    return Math.round((from * 3 + to) / 4)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

// 保留已发布的色板，分类浅底从原分类色和当前主题的浅强调色取值。
export function resolveThemeColors(palette: AppColors): AppColors {
  if (palette === defaultColors) return palette;
  return {
    ...palette,
    green: blendHex(palette.green, palette.primaryAccent),
    peach: blendHex(palette.peach, palette.primaryAccent),
    blue: blendHex(palette.blue, palette.primaryAccent),
    purple: blendHex(palette.purple, palette.primaryAccent),
  };
}
export type ThemeOption = {
  id: ThemeId;
  name: string;
  description: string;
  colors: AppColors;
  quiet?: boolean;
  signal?: string;
};
export const themeOptions: readonly ThemeOption[] = [
  {
    id: 'warm',
    name: '暖灰米',
    description: '原有的温暖日常',
    colors: defaultColors,
  },
  {
    id: 'mint',
    name: '薄荷花园',
    description: '清新的绿意与轻盈',
    colors: {
      ...defaultColors,
      background: '#F5FAF7',
      surface: '#FEFFFE',
      field: '#EAF4EE',
      ink: '#293E35',
      muted: '#53685C',
      brandFill: '#C2DFCF',
      onBrand: '#294E3D',
      primary: '#365F4C',
      primaryContainer: '#DFEEE5',
      primaryAccent: '#D6EBDD',
      border: '#CCDCD2',
      selectedIcon: '#436E59',
    },
  },
  {
    id: 'lavender',
    name: '柔雾紫',
    description: '静静绽放的一点浪漫',
    colors: {
      ...defaultColors,
      background: '#FAF7FD',
      surface: '#FFFEFF',
      field: '#F1EAF8',
      ink: '#3C3249',
      muted: '#685D75',
      brandFill: '#DFCFEC',
      onBrand: '#574166',
      primary: '#695079',
      primaryContainer: '#EDE3F4',
      primaryAccent: '#E6D9F0',
      border: '#DDD0E6',
      selectedIcon: '#78548E',
    },
  },
  {
    id: 'forest',
    name: '森林漫步',
    description: '鲜活叶绿，自然而明亮',
    quiet: true,
    signal: '#398653',
    colors: {
      ...defaultColors,
      background: '#FAFBFA',
      surface: '#FFFFFF',
      field: '#F4F5F4',
      ink: '#2D3C33',
      muted: '#53665A',
      brandFill: '#E5F4E8',
      onBrand: '#284E36',
      primary: '#365E46',
      primaryContainer: '#F5F6F5',
      primaryAccent: '#E5F4E8',
      border: '#DADFDA',
      selectedIcon: '#365E46',
    },
  },
  {
    id: 'sea',
    name: '晴空海盐',
    description: '清爽晴空蓝，轻盈明快',
    quiet: true,
    signal: '#287D9F',
    colors: {
      ...defaultColors,
      background: '#FAFBFA',
      surface: '#FFFFFF',
      field: '#F4F5F4',
      ink: '#283B44',
      muted: '#526773',
      brandFill: '#E3F2F8',
      onBrand: '#284D5E',
      primary: '#315C70',
      primaryContainer: '#F5F6F5',
      primaryAccent: '#E3F2F8',
      border: '#DADFDA',
      selectedIcon: '#315C70',
    },
  },
  {
    id: 'iris',
    name: '暮色鸢尾',
    description: '柔和花瓣紫，轻盈灵动',
    quiet: true,
    signal: '#8060B5',
    colors: {
      ...defaultColors,
      background: '#FAFBFA',
      surface: '#FFFFFF',
      field: '#F4F5F4',
      ink: '#393343',
      muted: '#665E70',
      brandFill: '#F0EAFA',
      onBrand: '#514163',
      primary: '#665078',
      primaryContainer: '#F5F6F5',
      primaryAccent: '#F0EAFA',
      border: '#DADFDA',
      selectedIcon: '#665078',
    },
  },
];
export function isThemeId(value: unknown): value is ThemeId {
  return themeOptions.some((option) => option.id === value);
}
export function getThemeOption(id: ThemeId): ThemeOption {
  return themeOptions.find((option) => option.id === id) ?? themeOptions[0];
}
