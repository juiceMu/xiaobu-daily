import { MD3LightTheme } from 'react-native-paper';
import { defaultColors, type AppColors } from './themeCatalog';
import { ICON_OPTIONS } from '../domain/iconCatalog.mjs';

export const colors = defaultColors;
export function createAppTheme(colors: AppColors) {
  return {
    ...MD3LightTheme,
    roundness: 4,
    fonts: {
      ...MD3LightTheme.fonts,
      headlineMedium: {
        ...MD3LightTheme.fonts.headlineMedium,
        fontSize: 16,
        lineHeight: 24,
      },
      titleLarge: {
        ...MD3LightTheme.fonts.titleLarge,
        fontSize: 16,
        lineHeight: 22,
      },
      titleMedium: {
        ...MD3LightTheme.fonts.titleMedium,
        fontSize: 14,
        lineHeight: 20,
      },
      bodyLarge: {
        ...MD3LightTheme.fonts.bodyLarge,
        fontSize: 14,
        lineHeight: 20,
      },
      bodyMedium: {
        ...MD3LightTheme.fonts.bodyMedium,
        fontSize: 13,
        lineHeight: 20,
      },
      labelLarge: {
        ...MD3LightTheme.fonts.labelLarge,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '500' as const,
      },
    },
    colors: {
      ...MD3LightTheme.colors,
      primary: colors.primary,
      onPrimary: '#FFFFFF',
      primaryContainer: colors.primaryContainer,
      onPrimaryContainer: colors.ink,
      secondary: colors.primary,
      onSecondary: '#FFFFFF',
      secondaryContainer: colors.primaryAccent,
      onSecondaryContainer: colors.ink,
      background: colors.background,
      surface: colors.surface,
      surfaceVariant: colors.field,
      tertiary: colors.primary,
      onTertiary: '#FFFFFF',
      tertiaryContainer: colors.purple,
      onTertiaryContainer: colors.ink,
      surfaceDisabled:
        colors === defaultColors ? '#F3EDE2' : colors.primaryContainer,
      onSurfaceDisabled: colors === defaultColors ? '#8E8173' : colors.muted,
      onSurface: colors.ink,
      onBackground: colors.ink,
      onSurfaceVariant: colors.muted,
      outline: colors === defaultColors ? '#928A7F' : colors.muted,
      outlineVariant: colors.border,
      error: colors.danger,
      inverseSurface: colors.ink,
      inverseOnSurface: colors.surface,
      inversePrimary: colors.primaryAccent,
      backdrop: 'rgba(54, 51, 47, 0.4)',
      elevation: {
        ...MD3LightTheme.colors.elevation,
        level0: 'transparent',
        level1: colors === defaultColors ? '#FFFEFC' : colors.surface,
        level2: colors === defaultColors ? '#FDF9F2' : colors.background,
        level3: colors === defaultColors ? '#FBF5EA' : colors.field,
        level4: colors === defaultColors ? '#FAF1E2' : colors.primaryAccent,
        level5: colors.primaryContainer,
      },
    },
  };
}
export const theme = createAppTheme(colors);
export const iconOptions = ICON_OPTIONS;
export function iconName(value?: string): string {
  return iconOptions.find(([key]) => key === value)?.[1] ?? 'sprout-outline';
}
export function tint(value: string, palette: AppColors = colors): string {
  return (
    palette[value as 'green' | 'peach' | 'blue' | 'purple'] ??
    palette.primaryContainer
  );
}
