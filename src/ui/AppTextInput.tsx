import React, { forwardRef, useId, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  TextInput as RNTextInput,
  View,
  useWindowDimensions,
  type TextInput as RNTextInputType,
} from 'react-native';
import { Text, TextInput as PaperTextInput } from 'react-native-paper';
import { useAppTheme } from './ThemeProvider';
import { useKeyboardFocus } from './useKeyboardFocus';
import { useAndroidMountReady } from './useAndroidMountReady';
import { numericInputError } from '../domain/engine';
import {
  finalizeNumericInput,
  normalizeNumericInput,
} from './numericInputModel';

type Props = React.ComponentPropsWithoutRef<typeof PaperTextInput> & {
  numericRule?: { kind: 'integer' | 'decimal'; min: number; max: number };
  validationVisible?: boolean;
  'aria-describedby'?: string;
};

// 标签固定在输入框上方；网页继续用 Paper，Android 点按后再挂原生输入，避开进页闪退。
export const AppTextInput = forwardRef<
  React.ComponentRef<typeof PaperTextInput> | RNTextInputType,
  Props
>(function AppTextInput(
  {
    label,
    accessibilityLabel,
    accessibilityLabelledBy,
    style,
    contentStyle,
    outlineStyle,
    onFocus,
    onBlur,
    onChange,
    onChangeText,
    right,
    error,
    numericRule,
    validationVisible,
    'aria-describedby': describedBy,
    ...props
  },
  ref,
) {
  const { colors, theme } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [numericDraft, setNumericDraft] = useState(props.defaultValue ?? '');
  const latestText = useRef(props.value ?? props.defaultValue ?? '');
  const latestChangeEvent = useRef<
    Parameters<NonNullable<Props['onChange']>>[0] | null
  >(null);
  if (props.value !== undefined) latestText.current = props.value;
  const fieldError =
    numericRule && (touched || validationVisible)
      ? numericInputError(
          props.value ?? numericDraft,
          numericRule.kind,
          numericRule.min,
          numericRule.max,
        )
      : '';
  error = error || !!fieldError;
  const keyboardFocus = useKeyboardFocus();
  const { fontScale } = useWindowDimensions();
  // 单行压缩到44dp，大字体时按实际行高扩展，备注不施加固定高度。
  const inputHeight = Math.max(44, Math.ceil(20 * fontScale + 20));
  // useId 含冒号，Android 无障碍资源名不接受，会在挂载时直接崩溃。
  const labelId = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const errorId = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const screenReady = useAndroidMountReady(300);
  // Android 进页不挂 EditText；用户点按字段后再创建，避开栈切换竞态。
  const [androidEditing, setAndroidEditing] = useState(false);
  const showNativeInput =
    Platform.OS !== 'android' || (screenReady && androidEditing);
  const inputRef = useRef<React.ComponentRef<typeof PaperTextInput> | null>(
    null,
  );
  const nativeRef = useRef<RNTextInputType | null>(null);
  const displayValue =
    numericRule && props.value === undefined
      ? numericDraft
      : (props.value ?? '');
  const fieldLabel =
    accessibilityLabel ?? (typeof label === 'string' ? label : undefined);

  return (
    <View collapsable={false} style={{ gap: 4, minWidth: 0 }}>
      {label != null && (
        <Text
          nativeID={labelId}
          style={{
            fontSize: 12,
            lineHeight: 18,
            color: error ? colors.danger : colors.muted,
          }}
          onPress={() => {
            if (!props.disabled) {
              if (Platform.OS === 'android') setAndroidEditing(true);
              else inputRef.current?.focus();
            }
          }}
        >
          {label}
        </Text>
      )}
      {showNativeInput ? (
        Platform.OS === 'android' ? (
          <RNTextInput
            autoCapitalize={props.autoCapitalize}
            autoComplete={props.autoComplete}
            autoCorrect={props.autoCorrect}
            blurOnSubmit={props.blurOnSubmit}
            keyboardType={props.keyboardType}
            maxLength={props.maxLength}
            multiline={props.multiline}
            numberOfLines={props.numberOfLines}
            placeholder={
              typeof props.placeholder === 'string'
                ? props.placeholder
                : undefined
            }
            returnKeyType={props.returnKeyType}
            secureTextEntry={props.secureTextEntry}
            textContentType={props.textContentType}
            ref={(instance) => {
              nativeRef.current = instance;
              if (typeof ref === 'function') ref(instance);
              else if (ref)
                (
                  ref as React.MutableRefObject<RNTextInputType | null>
                ).current = instance;
            }}
            collapsable={false}
            autoFocus
            editable={!props.disabled}
            value={String(displayValue ?? '')}
            onChangeText={(text) => {
              const next = numericRule
                ? normalizeNumericInput(text, numericRule.kind)
                : text;
              latestText.current = next;
              if (numericRule) setNumericDraft(next);
              onChangeText?.(next);
            }}
            accessibilityLabel={fieldLabel}
            accessibilityRole={
              props.accessibilityRole === 'search' ? 'search' : undefined
            }
            placeholderTextColor={colors.muted}
            style={[
              {
                minHeight: props.multiline ? 88 : inputHeight,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: props.multiline ? 10 : 0,
                fontSize: 14,
                lineHeight: 20,
                color: colors.ink,
                backgroundColor: focused
                  ? colors.primaryContainer
                  : theme.colors.surfaceVariant,
              },
              style,
            ]}
            onFocus={(event) => {
              setFocused(true);
              keyboardFocus.onFocus();
              onFocus?.(event as never);
            }}
            onBlur={(event) => {
              let blurEvent = event as never as Parameters<
                NonNullable<Props['onBlur']>
              >[0];
              if (numericRule) {
                const next = finalizeNumericInput(
                  latestText.current,
                  numericRule.kind,
                );
                if (next !== latestText.current) {
                  latestText.current = next;
                  setNumericDraft(next);
                  onChangeText?.(next);
                }
                blurEvent = {
                  ...blurEvent,
                  nativeEvent: {
                    ...blurEvent.nativeEvent,
                    text: latestText.current,
                  },
                };
                onBlur?.(blurEvent);
              } else {
                onBlur?.(blurEvent);
              }
              setTouched(true);
              setFocused(false);
              keyboardFocus.onBlur();
              setAndroidEditing(false);
            }}
          />
        ) : (
          <PaperTextInput
            {...props}
            collapsable={false}
            onChange={(event) => {
              if (!numericRule) {
                onChange?.(event);
                return;
              }
              const next = normalizeNumericInput(
                event.nativeEvent.text,
                numericRule.kind,
              );
              const normalizedEvent = {
                ...event,
                nativeEvent: { ...event.nativeEvent, text: next },
              };
              latestText.current = next;
              latestChangeEvent.current = normalizedEvent;
              setNumericDraft(next);
              onChange?.(normalizedEvent);
            }}
            value={
              numericRule && props.value === undefined
                ? numericDraft
                : props.value
            }
            onChangeText={(text) => {
              const next = numericRule
                ? normalizeNumericInput(text, numericRule.kind)
                : text;
              latestText.current = next;
              if (numericRule) setNumericDraft(next);
              onChangeText?.(next);
            }}
            label={undefined}
            accessibilityLabel={fieldLabel}
            accessibilityLabelledBy={
              accessibilityLabelledBy ??
              (label != null ? labelId : undefined)
            }
            ref={(instance: React.ComponentRef<typeof PaperTextInput> | null) => {
              inputRef.current = instance;
              if (typeof ref === 'function') ref(instance);
              else if (ref) ref.current = instance;
            }}
            error={error}
            aria-invalid={!!error}
            aria-describedby={
              Platform.OS === 'web'
                ? [describedBy, fieldError ? errorId : undefined]
                    .filter(Boolean)
                    .join(' ') || undefined
                : undefined
            }
            right={
              right ??
              (error ? (
                <PaperTextInput.Icon
                  icon="alert-circle-outline"
                  accessible={false}
                  focusable={false}
                  disabled
                  color={colors.danger}
                  forceTextInputFocus={false}
                />
              ) : undefined)
            }
            outlineStyle={[outlineStyle, { borderWidth: 0 }]}
            contentStyle={[
              contentStyle,
              { fontSize: 14, lineHeight: 20 },
              !props.multiline && { paddingTop: 10, paddingBottom: 10 },
            ]}
            style={[
              style,
              !props.multiline && { height: inputHeight },
              {
                fontSize: 14,
                lineHeight: 20,
                backgroundColor: focused
                  ? colors.primaryContainer
                  : theme.colors.surfaceVariant,
              },
              Platform.OS === 'web' && {
                outlineWidth: keyboardFocus.focusVisible ? 2 : 0,
                outlineStyle: 'solid',
                outlineColor: error ? colors.danger : colors.primary,
                outlineOffset: 2,
              },
            ]}
            onFocus={(event) => {
              setFocused(true);
              keyboardFocus.onFocus();
              onFocus?.(event);
            }}
            onBlur={(event) => {
              let blurEvent = event;
              if (numericRule) {
                const next = finalizeNumericInput(
                  latestText.current,
                  numericRule.kind,
                );
                if (next !== latestText.current) {
                  latestText.current = next;
                  setNumericDraft(next);
                  if (latestChangeEvent.current) {
                    onChange?.({
                      ...latestChangeEvent.current,
                      nativeEvent: {
                        ...latestChangeEvent.current.nativeEvent,
                        text: next,
                      },
                    });
                  }
                  onChangeText?.(next);
                }
                if (event.nativeEvent && typeof event.nativeEvent === 'object') {
                  blurEvent = {
                    ...event,
                    nativeEvent: {
                      ...event.nativeEvent,
                      text: latestText.current,
                    },
                  };
                }
              } else {
                onBlur?.(event);
              }
              setTouched(true);
              setFocused(false);
              keyboardFocus.onBlur();
              if (numericRule) onBlur?.(blurEvent);
            }}
          />
        )
      ) : (
        <Pressable
          disabled={!!props.disabled}
          accessibilityRole="button"
          accessibilityLabel={fieldLabel}
          onPress={() => {
            if (!props.disabled) setAndroidEditing(true);
          }}
          style={{
            minHeight: props.multiline ? 88 : inputHeight,
            borderRadius: 10,
            paddingHorizontal: 12,
            justifyContent: 'center',
            backgroundColor: focused
              ? colors.primaryContainer
              : theme.colors.surfaceVariant,
            opacity: props.disabled ? 0.5 : 1,
          }}
        >
          <Text
            numberOfLines={props.multiline ? undefined : 1}
            style={{
              fontSize: 14,
              lineHeight: 20,
              color: displayValue ? colors.ink : colors.muted,
            }}
          >
            {displayValue ||
              (typeof props.placeholder === 'string'
                ? props.placeholder
                : '点按填写')}
          </Text>
        </Pressable>
      )}
      {!!fieldError && (
        <Text
          nativeID={errorId}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ fontSize: 12, lineHeight: 18, color: colors.danger }}
        >
          {fieldError}
        </Text>
      )}
    </View>
  );
});
