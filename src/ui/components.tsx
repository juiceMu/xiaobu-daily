import React, {
  forwardRef,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
} from 'react-native-paper';
import { iconOptions } from './theme';
import { useAppTheme } from './ThemeProvider';
import { utilityColors, type AppColors } from './themeCatalog';
import { control, font, radius, space } from './uiTokens';
import { useReducedMotion } from './useReducedMotion';
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
          showsVerticalScrollIndicator
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews={false}
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
  const { colors, quiet } = useAppTheme();
  return (
    <View
      style={[
        styles.panel,
        quiet && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
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
      {action}
    </View>
  );
}
export type ActionTone =
  'primary' | 'neutral' | 'save' | 'reward' | 'archive' | 'danger';
export const ActionButton = forwardRef<
  View,
  Omit<ComponentProps<typeof Button>, 'style'> & {
    style?: StyleProp<ViewStyle>;
    tone?: ActionTone;
    size?: 'sm';
  }
>(function ActionButton(
  {
    contentStyle,
    style,
    labelStyle,
    accessibilityState,
    accessibilityLabel,
    accessibilityHint,
    accessibilityRole = 'button',
    accessible,
    children,
    mode = 'text',
    buttonColor,
    textColor,
    tone,
    size,
    disabled,
    loading = false,
    icon,
    uppercase,
    maxFontSizeMultiplier,
    onPress,
    onLongPress,
    onPressIn,
    onPressOut,
    onFocus,
    onBlur,
    delayLongPress,
    hitSlop,
    testID,
  },
  ref,
) {
  const { colors, quiet, theme, palette } = useAppTheme();
  const keyboardFocus = useKeyboardFocus();
  const reducedMotion = useReducedMotion();
  const unavailable = !!disabled || loading;
  const outlined = mode === 'outlined';
  const ghost =
    mode === 'text' && (!tone || tone === 'neutral') && !buttonColor;
  const actionTone =
    accessibilityState?.selected === false ? 'neutral' : (tone ?? 'primary');
  const tones = {
    primary: { fill: colors.brandFill, text: colors.onBrand },
    neutral: { fill: 'transparent', text: colors.muted },
    save: { fill: colors.save, text: colors.onSave },
    reward: quiet
      ? { fill: colors.brandFill, text: colors.onBrand }
      : { fill: colors.reward, text: colors.onReward },
    archive: { fill: colors.archive, text: colors.onArchive },
    danger: { fill: colors.danger, text: utilityColors.onSolid },
  };
  const softTone =
    palette && actionTone !== 'neutral' && actionTone !== 'danger'
      ? mode === 'contained'
        ? { fill: palette.brand.solid, text: utilityColors.onSolid }
        : { fill: palette.brand.soft, text: palette.brand.ink }
      : undefined;
  const activeTone = softTone ?? tones[actionTone];
  const fill =
    unavailable && !loading
      ? ghost
        ? 'transparent'
        : theme.colors.surfaceDisabled
      : (buttonColor ?? (ghost || outlined ? 'transparent' : activeTone.fill));
  const foreground =
    unavailable && !loading
      ? ghost
        ? colors.border
        : colors.muted
      : (textColor ??
        (buttonColor === colors.danger
          ? utilityColors.onSolid
          : activeTone.text));
  const label =
    typeof children === 'string' && uppercase
      ? children.toUpperCase()
      : children;
  const spokenLabel =
    accessibilityLabel ?? (typeof label === 'string' ? label : undefined);
  const selected = accessibilityState?.selected;
  const visuals = size === 'sm' ? control[26] : control[28];
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessible={accessible}
      accessibilityRole={accessibilityRole}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={
        selected === undefined || !spokenLabel
          ? spokenLabel
          : `${spokenLabel}，${selected ? '已选择' : '未选择'}`
      }
      accessibilityState={{
        ...accessibilityState,
        disabled: unavailable,
        busy: loading,
      }}
      aria-disabled={unavailable}
      aria-busy={loading}
      disabled={unavailable}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      delayLongPress={delayLongPress}
      hitSlop={hitSlop}
      onFocus={(event) => {
        keyboardFocus.onFocus();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        keyboardFocus.onBlur();
        onBlur?.(event);
      }}
      style={[
        {
          minWidth: control[44],
          minHeight: control[44],
          maxWidth: '100%',
          justifyContent: 'center',
          borderRadius: radius[6],
        },
        style,
        Platform.OS === 'web' && {
          cursor: (unavailable
            ? 'not-allowed'
            : 'pointer') as ViewStyle['cursor'],
          outlineWidth: !unavailable && keyboardFocus.focusVisible ? 2 : 0,
          outlineStyle: 'solid',
          outlineColor: colors.primary,
          outlineOffset: 2,
        },
      ]}
    >
      {({ pressed }) => (
        <View
          style={[
            {
              paddingHorizontal: space[10],
              minHeight: visuals,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: space[5],
              minWidth: 0,
            },
            contentStyle,
            {
              minHeight: visuals,
              borderRadius: radius[6],
              borderWidth:
                outlined || (unavailable && !loading && !ghost) ? 1 : 0,
              borderColor:
                unavailable && !loading ? colors.border : colors.primary,
              backgroundColor: fill,
              ...(pressed && !unavailable ? { opacity: 0.82 } : null),
            },
          ]}
        >
          {icon ? (
            <Icon
              source={icon}
              size={font[14]}
              color={loading ? 'transparent' : foreground}
            />
          ) : null}
          <Text
            aria-hidden={loading && !!spokenLabel}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            style={[
              {
                fontSize: font[12],
                fontWeight: '500',
                flexShrink: 1,
                minWidth: 0,
                textAlign: 'center',
              },
              labelStyle,
              { color: loading ? 'transparent' : foreground },
            ]}
          >
            {label}
          </Text>
          {loading ? (
            <View
              aria-hidden
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            >
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {reducedMotion ? (
                  <Icon
                    source="progress-clock"
                    size={font[14]}
                    color={foreground}
                  />
                ) : (
                  <ActivityIndicator size={font[14]} color={foreground} />
                )}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
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
const INITIAL_ICON_COUNT = 8;

export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: (typeof iconOptions)[number][0]) => void;
}) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(
    iconOptions.findIndex(([key]) => key === value) >= INITIAL_ICON_COUNT,
  );
  const selectedExtraIcon = iconOptions
    .slice(INITIAL_ICON_COUNT)
    .find(([key]) => key === value);
  // 表单复用时也展示当前选中项，主动收起不会把它藏起来。
  const visibleIcons = expanded
    ? iconOptions
    : [
        ...iconOptions.slice(0, INITIAL_ICON_COUNT),
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
      rippleColor={'transparent'}
      onFocus={keyboardFocus.onFocus}
      onBlur={keyboardFocus.onBlur}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={[
        styles.iconButton,
        {
          backgroundColor: 'transparent',
          overflow: 'hidden',
          borderRadius: 10,
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
  // 不可见时不挂 Modal，避免进页一次挂多个原生窗口。
  if (!visible) return null;
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
            rippleColor={'transparent'}
            style={{
              margin: 0,
              width: control[44],
              height: control[44],
              borderRadius: radius.full,
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
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            removeClippedSubviews={false}
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
    page: {
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      backgroundColor: colors.background,
    },
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
