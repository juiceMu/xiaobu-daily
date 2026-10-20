import Storage from 'expo-sqlite/kv-store';
import { createThemePreferenceRepository } from './themePreference';

// 独立偏好键，不触碰任务、奖券或奖励规则的业务仓库。
export const themePreferenceRepository = createThemePreferenceRepository({
  getItem: (key) => Storage.getItemAsync(key),
  setItem: (key, value) => Storage.setItemAsync(key, value),
});
