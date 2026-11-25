import React from 'react';
import { useAppTheme } from './ThemeProvider';
import { utilityColors } from './themeCatalog';
import { control, radius, space } from './uiTokens';
import { useKeyboardFocus } from './useKeyboardFocus';
import type { CompactSwitchProps } from './CompactSwitch';

export function CompactSwitch({
  value,
  disabled,
  onValueChange,
  accessibilityLabel,
}: CompactSwitchProps) {
  const { colors, theme } = useAppTheme();
  const focus = useKeyboardFocus();
  const track = disabled
    ? theme.colors.surfaceDisabled
    : value
      ? colors.primary
      : colors.border;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-disabled={disabled}
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={() => onValueChange(!value)}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={{
        width: control[44],
        height: control[44],
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        border: 0,
        borderRadius: radius.full,
        background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        outline: focus.focusVisible ? `2px solid ${colors.primary}` : undefined,
        outlineOffset: 2,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          boxSizing: 'border-box',
          width: 38,
          height: 22,
          border: 0,
          borderRadius: radius.full,
          display: 'flex',
          alignItems: 'center',
          justifyContent: value ? 'flex-end' : 'flex-start',
          paddingInline: space[2],
          backgroundColor: track,
          boxShadow: disabled ? `inset 0 0 0 1px ${colors.border}` : 'none',
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: radius.full,
            backgroundColor: utilityColors.onSolid,
          }}
        />
      </span>
    </button>
  );
}
