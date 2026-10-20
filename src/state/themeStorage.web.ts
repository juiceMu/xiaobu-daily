import { createThemePreferenceRepository } from './themePreference';

export const themePreferenceRepository = createThemePreferenceRepository({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
});
