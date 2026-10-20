import { DEFAULT_THEME_ID, isThemeId, type ThemeId } from '../ui/themeCatalog';

export const THEME_STORAGE_KEY = 'small-steps-theme-v1';
export type ThemePreferenceStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
};
export function parseThemePreference(raw: string | null): ThemeId {
  if (raw === null) return DEFAULT_THEME_ID;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isThemeId(parsed) ? parsed : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}
export function createThemePreferenceRepository(
  storage: ThemePreferenceStorage,
) {
  return {
    async load(): Promise<ThemeId> {
      return parseThemePreference(await storage.getItem(THEME_STORAGE_KEY));
    },
    async save(id: ThemeId): Promise<void> {
      if (!isThemeId(id)) throw new Error('请选择有效的主题');
      await storage.setItem(THEME_STORAGE_KEY, JSON.stringify(id));
    },
  };
}
