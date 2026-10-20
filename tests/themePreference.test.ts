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

test('五主题保留旧默认暖灰米、完整颜色键及独立业务语义', () => {
  assert.equal(DEFAULT_THEME_ID, 'warm');
  assert.deepEqual(
    themeOptions.map((option) => option.id),
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
      new Set(themeOptions.map((option) => option.colors[key])).size,
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
  assert.equal(option.colors.surface, '#FFFEFF');
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

test('偏好独立key支持同步和异步存储，五主题重建仓库后重载', async () => {
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
