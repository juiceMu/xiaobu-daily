import React, { useId, useState } from 'react';
import { useAppTheme } from './ThemeProvider';
import { isValidTime, type TimeFieldProps } from './timeFieldModel';
import { useKeyboardFocus } from './useKeyboardFocus';

export function TimeField({
  label,
  value,
  onChange,
  disabled,
}: TimeFieldProps) {
  const { colors } = useAppTheme();
  const id = useId();
  const [error, setError] = useState('');
  const keyboardFocus = useKeyboardFocus();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        htmlFor={id}
        style={{ fontSize: 12, lineHeight: '18px', color: colors.muted }}
      >
        {label}
      </label>
      <input
        id={id}
        type="time"
        step={60}
        value={value}
        disabled={disabled}
        required
        aria-invalid={!!error}
        aria-describedby={error ? id + '-error' : undefined}
        onFocus={keyboardFocus.onFocus}
        onBlur={keyboardFocus.onBlur}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (!isValidTime(next)) {
            setError('请选择有效的小时和分钟，已保留原时间。');
            return;
          }
          setError('');
          onChange(next);
        }}
        style={{
          boxSizing: 'border-box',
          minHeight: 44,
          minWidth: 0,
          width: '100%',
          fontFamily: 'inherit',
          fontSize: 14,
          lineHeight: '20px',
          padding: '12px',
          color: colors.ink,
          background: colors.field,
          border: 0,
          borderRadius: 12,
          outline: keyboardFocus.focusVisible
            ? '2px solid ' + colors.primary
            : 'none',
          outlineOffset: 2,
          opacity: disabled ? 0.6 : 1,
        }}
      />
      {error && (
        <span
          id={id + '-error'}
          role="alert"
          style={{ fontSize: 13, lineHeight: '20px', color: colors.danger }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
