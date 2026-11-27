import React, { useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, Text } from 'react-native-paper';
import type { MilestoneGoal, Ticket } from '../domain/types';
import { useAppTheme } from '../ui/ThemeProvider';
import { softThemeRoles } from '../ui/themeCatalog';
import { ActionButton, Empty } from '../ui/components';
import { formatChineseDateTime } from '../ui/displayDate';
import { useKeyboardFocus } from '../ui/useKeyboardFocus';

export function MilestoneTicketsEmpty() {
  return (
    <Empty
      icon="gift-outline"
      density="sheet"
      title="这个里程碑还没解锁奖券"
      description="继续积累，达到下一个刻度就能领到。"
    />
  );
}

export function MilestoneIconAction({
  icon,
  label,
  disabled,
  onPress,
  testID,
  expanded,
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
  expanded?: boolean;
}) {
  const { colors } = useAppTheme();
  const focus = useKeyboardFocus();
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, expanded }}
      disabled={disabled}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={{
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        backgroundColor:
          hovered && !disabled ? colors.primaryContainer : 'transparent',
        outlineWidth: focus.focusVisible ? 2 : 0,
        outlineColor: colors.primary,
        outlineStyle: 'solid',
      }}
      hitSlop={8}
    >
      <Icon
        source={icon}
        size={16}
        color={disabled ? colors.border : colors.muted}
      />
    </Pressable>
  );
}

export function MilestoneCard({
  item,
  index,
  next,
  disabled,
  invalidUnit,
  onManage,
  onRecord,
  onTickets,
}: {
  item: MilestoneGoal;
  index: number;
  next: number;
  disabled: boolean;
  invalidUnit: string;
  onManage: () => void;
  onRecord: () => void;
  onTickets: () => void;
}) {
  const { colors, palette } = useAppTheme();
  const focus = useKeyboardFocus();
  const [hovered, setHovered] = useState(false);
  const current = item.entries.at(-1)?.weight ?? item.startWeight ?? 0;
  const gap = Math.max(
    0,
    Math.round(
      (item.direction === 'increase' ? next - current : current - next) * 10,
    ) / 10,
  );
  const progress = Math.max(
    0,
    Math.min(
      100,
      (1 - gap / (item.step * (item.unlockedMilestones.length + 1))) * 100,
    ),
  );
  const atBoundary = next < 0 || next > 1000000;
  const dot = index % 2 === 0 ? palette?.c3.solid : palette?.c4.solid;
  return (
    <View
      testID="milestone-single-card"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: softThemeRoles.borderSoft,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        boxShadow: '0 2px 8px rgba(70,60,55,0.045)',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: dot,
            }}
          />
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: '500',
              color: colors.ink,
            }}
          >
            {item.name}
          </Text>
        </View>
        <MilestoneIconAction
          icon="dots-horizontal"
          label={item.name + '的更多操作'}
          disabled={disabled}
          onPress={onManage}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 3,
            flexShrink: 1,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '500', color: colors.ink }}>
            {current}
          </Text>
          <Text style={{ fontSize: 11, color: colors.muted }}>{item.unit}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              height: 4,
              borderRadius: 99,
              backgroundColor: softThemeRoles.borderSoft,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${!invalidUnit && !atBoundary ? progress : 0}%`,
                height: '100%',
                borderRadius: 99,
                backgroundColor: colors.primary,
              }}
            />
          </View>
          <Text style={{ fontSize: 11, marginTop: 6, color: colors.muted }}>
            {invalidUnit
              ? '请核对单位'
              : atBoundary
                ? '已到达当前方向的数值边界'
                : `下一刻度 ${next} ${item.unit} · 还差 ${gap}`}
          </Text>
        </View>
      </View>
      <Pressable
        testID="milestone-open-tickets"
        accessibilityRole="button"
        accessibilityLabel={`查看${item.name}解锁的奖券，共 ${item.unlockedMilestones.length} 张`}
        onPress={onTickets}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          minHeight: 32,
          paddingHorizontal: 10,
          marginTop: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: softThemeRoles.borderSoft,
          backgroundColor:
            hovered || pressed ? colors.background : colors.surface,
          outlineWidth: focus.focusVisible ? 2 : 0,
          outlineColor: colors.primary,
          outlineStyle: 'solid',
        })}
        hitSlop={6}
      >
        <Text style={{ fontSize: 15, fontWeight: '500', color: colors.ink }}>
          {item.unlockedMilestones.length} 张
        </Text>
        <Text style={{ flex: 1, fontSize: 11, color: colors.muted }}>
          已解锁奖券
        </Text>
        <View
          style={{
            width: 7,
            height: 7,
            borderTopWidth: 1,
            borderRightWidth: 1,
            borderColor: colors.muted,
            transform: [{ rotate: '45deg' }],
            marginRight: 2,
          }}
        />
      </Pressable>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginTop: 12,
        }}
      >
        <Text style={{ flex: 1, fontSize: 11, color: colors.muted }}>
          每 {item.step} {item.unit}解锁 1 张
        </Text>
        {item.archived ? (
          <Text style={{ fontSize: 11, color: colors.muted }}>已归档</Text>
        ) : (
          <ActionButton
            testID="milestone-record-action"
            size="sm"
            mode="contained-tonal"
            icon="pencil-outline"
            accessibilityLabel={'记录' + item.name + '的新数值'}
            disabled={disabled || !item.enabled || !!invalidUnit}
            onPress={onRecord}
            style={{ minHeight: 26 }}
            contentStyle={{ paddingHorizontal: 9 }}
            hitSlop={8}
          >
            {item.enabled ? '记录新数值' : '已暂停'}
          </ActionButton>
        )}
      </View>
    </View>
  );
}

export function MilestoneTicketSheet({
  goal,
  tickets,
  onClose,
}: {
  goal: MilestoneGoal;
  tickets: Ticket[];
  onClose: () => void;
}) {
  const { colors, palette } = useAppTheme();
  const [contentHeight, setContentHeight] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const hasOverflow = listHeight > 0 && contentHeight > listHeight + 1;
  const hasRemainingTickets = scrollY + listHeight < contentHeight - 1;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View
        style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}
      >
        <Pressable
          accessible={false}
          onPress={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(31,28,25,0.42)',
          }}
        />
        <SafeAreaView
          edges={['bottom']}
          accessibilityViewIsModal
          testID="milestone-ticket-sheet"
          style={{
            width: '100%',
            maxWidth: 600,
            maxHeight: '88%',
            backgroundColor: colors.surface,
            padding: 16,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                flex: 1,
                fontSize: 18,
                fontWeight: '500',
                color: colors.ink,
              }}
            >
              {goal.name} · 已解锁奖券
            </Text>
            <MilestoneIconAction
              icon="close"
              label="关闭奖券列表"
              onPress={onClose}
            />
          </View>
          <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 10 }}>
            共 {tickets.length} 张 · 永久有效，不受到期设置影响
          </Text>
          <FlatList
            style={{ flexGrow: 0, flexShrink: 1, minHeight: 0 }}
            data={tickets}
            keyExtractor={(ticket) => ticket.id}
            onLayout={({ nativeEvent }) =>
              setListHeight(nativeEvent.layout.height)
            }
            onContentSizeChange={(_, height) => setContentHeight(height)}
            onScroll={({ nativeEvent }) =>
              setScrollY(nativeEvent.contentOffset.y)
            }
            scrollEventThrottle={16}
            ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
            ListEmptyComponent={MilestoneTicketsEmpty}
            renderItem={({ item, index }) => (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 52,
                  paddingVertical: 7,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: softThemeRoles.borderSoft,
                  backgroundColor: item.usedAt ? colors.field : colors.surface,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: item.usedAt
                      ? 'transparent'
                      : palette?.brand.soft,
                    borderWidth: item.usedAt ? 1 : 0,
                    borderColor: softThemeRoles.borderSoft,
                  }}
                >
                  <Icon
                    source="gift-outline"
                    size={14}
                    color={
                      item.usedAt
                        ? colors.muted
                        : (palette?.brand.ink ?? colors.primary)
                    }
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 12,
                      lineHeight: 16,
                      fontWeight: item.usedAt ? '400' : '500',
                      color: item.usedAt ? colors.muted : colors.ink,
                    }}
                  >
                    {goal.name} · 第 {index + 1} 张
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 10,
                      lineHeight: 14,
                      color: colors.muted,
                    }}
                  >
                    {item.milestone} {item.unit ?? goal.unit} 刻度 ·{' '}
                    {formatChineseDateTime(item.createdAt)} · 永久有效
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 10,
                    color: colors.muted,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: softThemeRoles.borderSoft,
                    borderRadius: 4,
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                  }}
                >
                  {item.usedAt ? '已使用' : '可用'}
                </Text>
              </View>
            )}
          />
          {hasOverflow && (
            <View
              accessibilityElementsHidden
              aria-hidden
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 18,
                marginTop: 6,
                opacity: hasRemainingTickets ? 1 : 0,
              }}
            >
              <View
                style={{
                  width: 14,
                  height: 2,
                  borderRadius: 99,
                  backgroundColor: colors.border,
                }}
              />
              <Text style={{ fontSize: 10, color: colors.muted }}>
                上滑查看剩余券
              </Text>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
