import React, {
  forwardRef,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  Icon,
  IconButton,
  Text,
  TouchableRipple,
  useTheme,
  type MD3Theme,
} from 'react-native-paper';
import { iconOptions } from './theme';
import { useAppTheme } from './ThemeProvider';
import type { AppColors } from './themeCatalog';
import { useKeyboardFocus } from './useKeyboardFocus';

export function Page({
  title,
  subtitle,
  children,
  scroll = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
}) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const gutter = width < 360 ? 12 : 16;
  const heading = (
    <View style={styles.heading}>
      <Text
        accessibilityRole="header"
        variant="headlineMedium"
        style={styles.title}
      >
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
  return (
    <View style={styles.page}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: gutter },
          ]}
        >
          {heading}
          {children}
        </ScrollView>
      ) : (
        <View
          style={[styles.content, styles.flex, { paddingHorizontal: gutter }]}
        >
          {heading}
          {children}
        </View>
      )}
    </View>
  );
}
export function Panel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return <View style={[styles.panel, style]}>{children}</View>;
}
export function Empty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { colors } = useAppTheme();
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon source="sprout-outline" size={24} color={colors.primary} />
      </View>
      <Text variant="titleMedium" style={styles.center}>
        {title}
      </Text>
      <Text style={[styles.subtitle, styles.center]}>{description}</Text>
    </View>
  );
}
export type ActionTone =
  'primary' | 'neutral' | 'save' | 'reward' | 'archive' | 'danger';
export const ActionButton = forwardRef<
  View,
  ComponentProps<typeof Button> & { tone?: ActionTone }
>(function ActionButton(
  {
    contentStyle,
    style,
    labelStyle,
    accessibilityState,
    accessibilityLabel,
    children,
    mode = 'text',
    buttonColor,
    textColor,
    tone,
    disabled,
    compact = true,
    theme: themeOverrides,
    rippleColor,
    onPointerEnter,
    onPointerLeave,
    onFocus,
    onBlur,
    onPressIn,
    onPressOut,
    ...props
  },
  ref,
) {
  const { colors } = useAppTheme();
  const styles = useStyles();
  const [hovered, setHovered] = useState(false);
  const keyboardFocus = useKeyboardFocus();
  const [pressed, setPressed] = useState(false);
  const isWeb = Platform.OS === 'web';
  const buttonTheme = useTheme<MD3Theme>(
    themeOverrides as Parameters<typeof useTheme<MD3Theme>>[0],
  );
  const filled =
    mode === 'contained' || mode === 'contained-tonal' || mode === 'elevated';
  const outlined = mode === 'outlined';
  const actionTone =
    accessibilityState?.selected === false ? 'neutral' : (tone ?? 'primary');
  const tones = {
    primary: { fill: colors.brandFill, text: colors.onBrand },
    neutral: { fill: 'transparent', text: colors.muted },
    save: { fill: colors.save, text: colors.onSave },
    reward: { fill: colors.reward, text: colors.onReward },
    archive: { fill: colors.archive, text: colors.onArchive },
    danger: { fill: colors.danger, text: '#FFFFFF' },
  };
  const fill = disabled
    ? filled
      ? buttonTheme.colors.surfaceDisabled
      : 'transparent'
    : (buttonColor ??
      (actionTone === 'neutral'
        ? 'transparent'
        : filled || outlined || tone
          ? tones[actionTone].fill
          : 'transparent'));
  const foreground =
    textColor ??
    (buttonColor === colors.danger
      ? buttonTheme.colors.onError
      : tones[actionTone].text);
  const active = isWeb && !disabled && (hovered || pressed);
  const base = fill === 'transparent' ? colors.surface : fill;
  const strength = pressed ? 0.12 : 0.07;
  // 按压和悬停仅叠加底色，轮廓只用于键盘焦点。
  const feedbackFill =
    /^#[0-9a-f]{6}$/i.test(base) && /^#[0-9a-f]{6}$/i.test(foreground)
      ? '#' +
        [1, 3, 5]
          .map((offset) =>
            Math.round(
              parseInt(base.slice(offset, offset + 2), 16) * (1 - strength) +
                parseInt(foreground.slice(offset, offset + 2), 16) * strength,
            )
              .toString(16)
              .padStart(2, '0'),
          )
          .join('')
      : fill;
  // 外层保留原生48dp/web40dp触控，内层只绘制30dp视觉。
  return (
    <Button
      {...props}
      ref={ref}
      mode="text"
      compact={compact}
      disabled={disabled}
      theme={themeOverrides}
      buttonColor="transparent"
      textColor={foreground}
      rippleColor={isWeb ? 'transparent' : rippleColor}
      onPointerEnter={(event) => {
        if (isWeb && !disabled) setHovered(true);
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        setHovered(false);
        onPointerLeave?.(event);
      }}
      onFocus={(event) => {
        keyboardFocus.onFocus();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        keyboardFocus.onBlur();
        setPressed(false);
        onBlur?.(event);
      }}
      onPressIn={(event) => {
        if (isWeb && !disabled) setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      accessibilityState={accessibilityState}
      accessibilityLabel={
        accessibilityState?.selected !== undefined
          ? `${accessibilityLabel ?? (typeof children === 'string' ? children : '选项')}，${accessibilityState.selected ? '已选择' : '未选择'}`
          : accessibilityLabel
      }
      style={[
        styles.button,
        isWeb && { minWidth: 40, minHeight: 40 },
        style,
        { backgroundColor: 'transparent', borderWidth: 0 },
      ]}
      labelStyle={[
        {
          fontSize: 12,
          lineHeight: 18,
          fontWeight: '500',
          marginVertical: 6,
          marginHorizontal: 8,
          flexShrink: 1,
        },
        labelStyle,
      ]}
      contentStyle={[
        {
          minHeight: 30,
          marginVertical: isWeb ? 5 : 9,
          flexShrink: 0,
          borderRadius: 10,
          backgroundColor: fill,
          borderWidth: 0,
        },
        contentStyle,
        isWeb && {
          backgroundColor: active ? feedbackFill : fill,
          outlineWidth: !disabled && keyboardFocus.focusVisible ? 2 : 0,
          outlineStyle: 'solid',
          outlineColor: foreground,
          outlineOffset: -2,
        },
      ]}
    >
      {children}
    </Button>
  );
});
export function SectionTitle({
  title,
  action,
  titleStyle,
}: {
  title: string;
  action?: ReactNode;
  titleStyle?: StyleProp<TextStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        variant="titleLarge"
        style={[styles.sectionText, titleStyle]}
      >
        {title}
      </Text>
      {action}
    </View>
  );
}
export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: (typeof iconOptions)[number][0]) => void;
}) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(
    iconOptions.findIndex(([key]) => key === value) >= 16,
  );
  const selectedExtraIcon = iconOptions
    .slice(16)
    .find(([key]) => key === value);
  // 表单复用时也展示当前选中项，主动收起不会把它藏起来。
  const visibleIcons = expanded
    ? iconOptions
    : [
        ...iconOptions.slice(0, 16),
        ...(selectedExtraIcon ? [selectedExtraIcon] : []),
      ];
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.icons}>
        {visibleIcons.map(([key, name, label]) => (
          <IconChoice
            key={key}
            selected={value === key}
            name={name}
            label={label}
            onPress={() => onChange(key)}
          />
        ))}
      </View>
      <Text style={styles.subtitle}>
        当前图标：{iconOptions.find(([key]) => key === value)?.[2] ?? '未选择'}
      </Text>
      <ActionButton
        onPress={() => setExpanded(!expanded)}
        accessibilityState={{ expanded }}
        style={{ alignSelf: 'flex-start' }}
        mode="text"
      >
        {expanded
          ? '收起更多图标'
          : `展开更多图标（${iconOptions.length - 16}）`}
      </ActionButton>
    </View>
  );
}
function IconChoice({
  selected,
  name,
  label,
  onPress,
}: {
  selected: boolean;
  name: string;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useStyles();
  const keyboardFocus = useKeyboardFocus();
  return (
    <TouchableRipple
      onPress={onPress}
      onFocus={keyboardFocus.onFocus}
      onBlur={keyboardFocus.onBlur}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={[
        styles.iconButton,
        {
          backgroundColor: 'transparent',
          outlineWidth: keyboardFocus.focusVisible ? 2 : 0,
          outlineStyle: 'solid',
          outlineColor: colors.primary,
          outlineOffset: -2,
        },
      ]}
    >
      <View
        style={[
          styles.iconContent,
          {
            backgroundColor: selected ? colors.selectedIcon : colors.field,
          },
        ]}
      >
        <Icon
          source={name}
          size={18}
          color={selected ? colors.surface : colors.primary}
        />
      </View>
    </TouchableRipple>
  );
}
export function FormModal({
  visible,
  title,
  onDismiss,
  children,
}: {
  visible: boolean;
  title: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <Modal
      visible={visible}
      animationType="none"
      onRequestClose={onDismiss}
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.page}>
        <View style={styles.modalHeader}>
          <Text
            variant="titleLarge"
            style={styles.sectionText}
            accessibilityRole="header"
          >
            {title}
          </Text>
          <IconButton
            icon="close"
            accessibilityLabel="关闭表单"
            size={16}
            hitSlop={0}
            style={{
              margin: 0,
              width: Platform.OS === 'web' ? 32 : 44,
              height: Platform.OS === 'web' ? 32 : 44,
              backgroundColor: 'transparent',
            }}
            onPress={onDismiss}
          />
        </View>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.formContent}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    page: { flex: 1, backgroundColor: colors.background },
    content: {
      width: '100%',
      maxWidth: 600,
      alignSelf: 'center',
      paddingTop: 16,
      paddingBottom: 16,
      gap: 8,
    },
    heading: { gap: 4, marginBottom: 4, flexShrink: 0 },
    title: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '600',
      color: colors.ink,
    },
    subtitle: { fontSize: 12, lineHeight: 18, color: colors.muted },
    panel: {
      borderRadius: 18,
      borderWidth: 0,
      backgroundColor: colors.surface,
      padding: 12,
      gap: 8,
      flexShrink: 0,
    },
    button: {
      borderRadius: 10,
      minWidth: 48,
      minHeight: 48,
      flexShrink: 0,
      maxWidth: '100%',
    },
    section: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      flexShrink: 0,
    },
    sectionText: { flex: 1, fontWeight: '600' },
    empty: { paddingVertical: 24, gap: 8, alignItems: 'center' },
    center: { textAlign: 'center' },
    emptyIcon: {
      padding: 14,
      backgroundColor: colors.primaryContainer,
      borderRadius: 28,
    },
    icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    iconButton: {
      width: 48,
      height: 48,
      borderRadius: 10,
      borderWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconContent: {
      width: 32,
      height: 32,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingLeft: 16,
      paddingRight: 8,
      paddingTop: 16,
      paddingBottom: 4,
    },
    formContent: {
      padding: 16,
      paddingBottom: 48,
      gap: 10,
      width: '100%',
      maxWidth: 640,
      alignSelf: 'center',
    },
  });

function useStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}
