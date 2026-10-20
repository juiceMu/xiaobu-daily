import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { themePreferenceRepository } from '../state/themeStorage';
import { createAppTheme } from './theme';
import { DEFAULT_THEME_ID, getThemeOption, type ThemeId } from './themeCatalog';

function useThemeValue() {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [themeBusy, setThemeBusy] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  const [themeError, setThemeError] = useState('');
  const changing = useRef(false);
  useEffect(() => {
    let active = true;
    void themePreferenceRepository
      .load()
      .then((id) => {
        if (active) setThemeId(id);
      })
      .catch(() => {
        if (active)
          setThemeError('主题偏好读取失败，暂用暖灰米；可稍后重新选择。');
      })
      .finally(() => {
        if (active) setThemeReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const option = getThemeOption(themeId);
  const theme = useMemo(() => createAppTheme(option.colors), [option.colors]);
  async function selectTheme(id: ThemeId): Promise<boolean> {
    if (!themeReady || changing.current) return false;
    if (id === themeId && !themeError) return true;
    changing.current = true;
    setThemeBusy(true);
    setThemeError('');
    try {
      await themePreferenceRepository.save(id);
      setThemeId(id);
      return true;
    } catch {
      setThemeError('主题保存失败，已保留当前主题。请检查存储空间后重试。');
      return false;
    } finally {
      changing.current = false;
      setThemeBusy(false);
    }
  }
  return {
    themeId,
    colors: option.colors,
    theme,
    selectTheme,
    themeBusy,
    themeError,
    themeReady,
  };
}
type ThemeContextValue = ReturnType<typeof useThemeValue>;
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useThemeValue();
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
export function useAppTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme 必须在 ThemeProvider 内使用');
  return value;
}
