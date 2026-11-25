import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultColors,
  applyTheme,
  DEFAULT_THEME_ID,
  themeOptions,
  getThemeOption,
  isThemeId,
  resolveThemeColors,
  type ThemeId,
} from '../src/ui/themeCatalog';
import {
  createThemePreferenceRepository,
  parseThemePreference,
  THEME_STORAGE_KEY,
} from '../src/state/themePreference';

test('切换主题时四种分类同时更新，且原色板与任务色键保持可用', () => {
  const categories = ['green', 'peach', 'blue', 'purple'] as const;
  const palettes = themeOptions
    .filter((option) => !option.palette)
    .map(({ colors }) => resolveThemeColors(colors));
  assert.equal(palettes[0], defaultColors);
  for (const category of categories) {
    assert.equal(
      new Set(palettes.map((colors) => colors[category])).size,
      palettes.length,
    );
    for (const option of themeOptions.filter((option) => !option.palette)) {
      assert.equal(option.colors[category], defaultColors[category]);
    }
  }
  for (const colors of palettes) {
    assert.equal(
      new Set(categories.map((category) => colors[category])).size,
      categories.length,
    );
  }
});

test('暖灰米、薄荷花园和柔雾紫的颜色保持原样', () => {
  const original = {
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
  const originals = [
    ['暖灰米', original],
    [
      '薄荷花园',
      {
        ...original,
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
    ],
    [
      '柔雾紫',
      {
        ...original,
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
    ],
  ] as const;
  for (const [index, [name, colors]] of originals.entries()) {
    assert.equal(themeOptions[index].name, name);
    assert.deepEqual(themeOptions[index].colors, colors);
  }
});

test('九套主题的编号、名称与顺序正确', () => {
  assert.deepEqual(
    themeOptions.map(({ id, name }) => [id, name]),
    [
      ['warm', '暖灰米'],
      ['mint', '薄荷花园'],
      ['lavender', '柔雾紫'],
      ['forest', '森林漫步'],
      ['sea', '晴空海盐'],
      ['iris', '暮色鸢尾'],
      ['matcha', '抹茶拿铁'],
      ['taro', '香芋啵啵'],
      ['blueberry', '蓝莓酸奶'],
    ],
  );
});

test('主题保留旧默认暖灰米、完整颜色键及独立业务语义', () => {
  assert.equal(DEFAULT_THEME_ID, 'warm');
  assert.equal(getThemeOption('warm').colors, defaultColors);
  assert.equal(defaultColors.brandFill, '#DCCFBE');
  assert.equal(defaultColors.primary, '#625B53');
  assert.equal(defaultColors.background, '#FFFCF8');
  const stableKeys = [
    'green',
    'peach',
    'blue',
    'purple',
    'danger',
    'save',
    'onSave',
    'reward',
    'onReward',
    'archive',
    'onArchive',
  ] as const;
  for (const option of themeOptions) {
    assert.ok(option.name && option.description);
    assert.equal(isThemeId(option.id), true);
    assert.equal(getThemeOption(option.id), option);
    assert.deepEqual(
      Object.keys(option.colors).sort(),
      Object.keys(defaultColors).sort(),
    );
    for (const key of option.palette ? [] : stableKeys)
      assert.equal(
        option.colors[key],
        defaultColors[key],
        option.id + ':' + key,
      );
  }
  for (const key of ['brandFill', 'primary'] as const)
    assert.equal(
      new Set(themeOptions.map((option) => option.colors[key])).size,
      themeOptions.length,
      key,
    );
  for (const value of [null, undefined, true, {}, [], 'unknown', 'Warm', ''])
    assert.equal(isThemeId(value), false);
});

test('已移除的主题偏好回退暖灰米，保留原值直到主动切换', async () => {
  for (const id of ['peach', 'white', 'apricot']) {
    assert.equal(isThemeId(id), false);
    const entries = new Map([
      [THEME_STORAGE_KEY, JSON.stringify(id)],
      ['sprout-native-sync-v1', '业务原始数据'],
    ]);
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value);
      },
    };
    const repository = createThemePreferenceRepository(storage);
    assert.equal(await repository.load(), DEFAULT_THEME_ID);
    await assert.rejects(repository.save(id as ThemeId), /请选择有效的主题/);
    assert.equal(entries.get(THEME_STORAGE_KEY), JSON.stringify(id));
    await repository.save('iris');
    assert.equal(await createThemePreferenceRepository(storage).load(), 'iris');
    assert.equal(entries.get('sprout-native-sync-v1'), '业务原始数据');
  }
});

test('无偏好或非法内容回退默认，不写回或污染原始存储', async () => {
  const invalid = [
    null,
    '',
    'warm',
    'undefined',
    'null',
    'true',
    '123',
    '{}',
    '[]',
    '{',
    JSON.stringify('unknown'),
  ];
  for (const raw of invalid) {
    let writes = 0;
    const repository = createThemePreferenceRepository({
      getItem(key) {
        assert.equal(key, THEME_STORAGE_KEY);
        return raw;
      },
      setItem() {
        writes++;
      },
    });
    assert.equal(parseThemePreference(raw), 'warm');
    assert.equal(await repository.load(), 'warm');
    assert.equal(writes, 0);
  }
});

test('偏好独立key支持同步和异步存储，所有主题重建仓库后重载', async () => {
  assert.equal(THEME_STORAGE_KEY, 'small-steps-theme-v1');
  const entries = new Map([['sprout-native-sync-v1', '业务原始数据']]);
  const storage = {
    async getItem(key: string) {
      return entries.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      entries.set(key, value);
    },
  };
  for (const option of themeOptions) {
    await createThemePreferenceRepository(storage).save(option.id);
    assert.equal(entries.get(THEME_STORAGE_KEY), JSON.stringify(option.id));
    assert.equal(
      await createThemePreferenceRepository(storage).load(),
      option.id,
    );
  }
  assert.equal(entries.get('sprout-native-sync-v1'), '业务原始数据');
});

test('读取保存异常上抛、旧偏好保留，可恢复后重试；无效主题不写', async () => {
  let raw = JSON.stringify('mint');
  let readFailure = true;
  let saveFailure = true;
  let writes = 0;
  const repository = createThemePreferenceRepository({
    getItem() {
      if (readFailure) throw new Error('读取不可用');
      return raw;
    },
    async setItem(_key, value) {
      writes++;
      if (saveFailure) throw new Error('写入不可用');
      raw = value;
    },
  });
  await assert.rejects(repository.load(), /读取不可用/);
  assert.equal(raw, JSON.stringify('mint'));
  readFailure = false;
  assert.equal(await repository.load(), 'mint');
  await assert.rejects(repository.save('iris'), /写入不可用/);
  assert.equal(await repository.load(), 'mint');
  await assert.rejects(repository.save('bad' as ThemeId));
  assert.equal(writes, 1);
  saveFailure = false;
  await repository.save('iris');
  assert.equal(await repository.load(), 'iris');
});

test('三套柔彩主题直接应用四组配色，六套旧主题仍以原目录为来源', () => {
  for (const { id, palette, colors } of themeOptions) {
    const active = applyTheme(id);
    if (!palette) {
      assert.deepEqual(active.colors, resolveThemeColors(colors));
      continue;
    }
    assert.equal(active.colors, colors);
    assert.equal(active.colors.primary, palette.brand.solid);
    assert.deepEqual(
      [colors.green, colors.peach, colors.blue, colors.purple],
      [
        palette.brand.soft,
        palette.accent.soft,
        palette.c3.soft,
        palette.c4.soft,
      ],
    );
  }
});
