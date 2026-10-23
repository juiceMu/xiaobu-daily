export const DEFAULT_THEME_ID = 'warm';
export type ThemeId = 'warm' | 'mint' | 'lavender' | 'peach' | 'white';

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
export type ThemeOption = {
  id: ThemeId;
  name: string;
  description: string;
  colors: AppColors;
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
    id: 'peach',
    name: '蜜桃粉',
    description: '温柔明亮的小小心情',
    colors: {
      ...defaultColors,
      background: '#FFF7F5',
      surface: '#FFFEFD',
      field: '#FCECE7',
      ink: '#4C3335',
      muted: '#795E60',
      brandFill: '#F0CEC7',
      onBrand: '#6D4443',
      primary: '#79504F',
      primaryContainer: '#F9E4DE',
      primaryAccent: '#F4DBD4',
      border: '#EACFC7',
      selectedIcon: '#9A5B69',
    },
  },
  {
    id: 'white',
    name: '极简白',
    description: '淡紫淡黄，干净轻盈',
    colors: {
      ...defaultColors,
      background: '#FFFFFF',
      // 卡片用淡紫灰，避免和纯白页底糊成一片。
      surface: '#F6F3FB',
      field: '#F8F1DC',
      ink: '#3A3350',
      muted: '#655C7A',
      brandFill: '#E8E2F2',
      onBrand: '#4A3870',
      primary: '#65508A',
      primaryContainer: '#F3EBD4',
      primaryAccent: '#EFEAF6',
      border: '#E4DEEC',
      selectedIcon: '#65508A',
    },
  },
];
export function isThemeId(value: unknown): value is ThemeId {
  return themeOptions.some((option) => option.id === value);
}
export function getThemeOption(id: ThemeId): ThemeOption {
  return themeOptions.find((option) => option.id === id) ?? themeOptions[0];
}
