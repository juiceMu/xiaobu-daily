import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultColors,
  DEFAULT_THEME_ID,
  themeOptions,
  getThemeOption,
  isThemeId,
  type ThemeId,
} from '../src/ui/themeCatalog';
import {
  createThemePreferenceRepository,
  parseThemePreference,
  THEME_STORAGE_KEY,
} from '../src/state/themePreference';

test('旧五套主题所有颜色保持原样', () => {
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
    [
      '蜜桃粉',
      {
        ...original,
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
    ],
    [
      '极简白',
      {
        ...original,
        background: '#FFFFFF',
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
    ],
  ] as const;
  for (const [index, [name, colors]] of originals.entries()) {
    assert.equal(themeOptions[index].name, name);
    assert.deepEqual(themeOptions[index].colors, colors);
  }
});

test('四套新主题有独立稳定编号和名称', () => {
  assert.deepEqual(
    themeOptions.slice(5).map(({ id, name }) => [id, name]),
    [
      ['apricot', '晨光暖杏'],
      ['forest', '森林漫步'],
      ['sea', '晴空海盐'],
      ['iris', '暮色鸢尾'],
    ],
  );
});

test('主题保留旧默认暖灰米、完整颜色键及独立业务语义', () => {
  assert.equal(DEFAULT_THEME_ID, 'warm');
  assert.deepEqual(
    themeOptions.slice(0, 5).map((option) => option.id),
    ['warm', 'mint', 'lavender', 'peach', 'white'],
  );
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
    for (const key of stableKeys)
      assert.equal(
        option.colors[key],
        defaultColors[key],
        option.id + ':' + key,
      );
  }
  for (const key of ['brandFill', 'primary', 'background', 'field'] as const)
    assert.equal(
      new Set(themeOptions.slice(0, 5).map((option) => option.colors[key]))
        .size,
      5,
      key,
    );
  for (const value of [null, undefined, true, {}, [], 'unknown', 'Warm', ''])
    assert.equal(isThemeId(value), false);
});

test('极简白保持纯白背景、淡紫淡黄层级及独立偏好往返', async () => {
  const option = getThemeOption('white');
  assert.equal(option.name, '极简白');
  assert.equal(option.colors.background, '#FFFFFF');
  assert.equal(option.colors.surface, '#F6F3FB');
  assert.equal(option.colors.field, '#F8F1DC');
  assert.equal(option.colors.brandFill, '#E8E2F2');
  assert.equal(option.colors.primaryContainer, '#F3EBD4');
  assert.equal(option.colors.primaryAccent, '#EFEAF6');
  for (const key of [
    'background',
    'surface',
    'field',
    'ink',
    'muted',
    'brandFill',
    'onBrand',
    'primary',
    'primaryContainer',
    'primaryAccent',
    'border',
    'selectedIcon',
  ] as const) {
    assert.match(option.colors[key], /^#[0-9A-F]{6}$/);
  }
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
  await createThemePreferenceRepository(storage).save('white');
  assert.equal(entries.get(THEME_STORAGE_KEY), JSON.stringify('white'));
  assert.equal(
    parseThemePreference(entries.get(THEME_STORAGE_KEY) ?? null),
    'white',
  );
  assert.equal(await createThemePreferenceRepository(storage).load(), 'white');
  assert.equal(DEFAULT_THEME_ID, 'warm');
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
  const entries = new Map([['sprout-native-web-v1', '业务原始数据']]);
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
  assert.equal(entries.get('sprout-native-web-v1'), '业务原始数据');
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
  await assert.rejects(repository.save('peach'), /写入不可用/);
  assert.equal(await repository.load(), 'mint');
  await assert.rejects(repository.save('bad' as ThemeId));
  assert.equal(writes, 1);
  saveFailure = false;
  await repository.save('peach');
  assert.equal(await repository.load(), 'peach');
});
