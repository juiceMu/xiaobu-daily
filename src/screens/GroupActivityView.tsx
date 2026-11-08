import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import {
  getGroupActivity,
  rankingProgress,
  timelineDateLabel,
} from '../domain/groupActivity';
import { dateKey } from '../domain/engine';
import type { AppState } from '../domain/types';
import { peerBoards } from '../domain/groupSync';
import { ActionButton, Panel } from '../ui/components';
import { ProfileAvatar } from '../ui/ProfileAvatar';
import { useAppTheme } from '../ui/ThemeProvider';
import { formatDate, useScreenStyles } from './shared';

type Activity = ReturnType<typeof getGroupActivity>;

export function GroupActivityView({
  state,
  selectedNow,
  now,
  historicalWeek,
}: {
  state: AppState;
  selectedNow: Date;
  now: Date;
  historicalWeek: boolean;
}) {
  const styles = useScreenStyles();
  const { colors, quiet } = useAppTheme();
  const [visibleCount, setVisibleCount] = useState(30);
  const activity: Activity = getGroupActivity(
    state,
    state.groupLink ? peerBoards(state) : [],
    selectedNow,
  );
  return (
    <View testID="group-activity-list" style={styles.column}>
      {!state.groupLink ? (
        <Text style={styles.muted}>
          尚未加入小组，目前仅显示自己的打卡记录。
        </Text>
      ) : activity.rankings.length === 1 ? (
        <Text style={styles.muted}>
          暂无其他成员数据，同步后可查看成员打卡。
        </Text>
      ) : (
        <Text style={styles.muted}>
          其他成员数据来自最近一次同步，打开应用不会自动同步。
        </Text>
      )}
      <Text accessibilityRole="header" style={styles.heading}>
        {historicalWeek ? '所选周打卡排行榜' : '本周打卡排行榜'}
      </Text>
      <Panel style={styles.card}>
        <Text style={styles.muted}>合计 {activity.total} 次</Text>
        {activity.rankings.map((member) => (
          <View
            key={member.accountId}
            style={[styles.row, { minHeight: 54, gap: 10 }]}
          >
            <View style={[styles.row, { gap: 12 }]}>
              <Text style={[styles.body, { color: colors.primary }]}>
                {member.rank}
              </Text>
              <ProfileAvatar avatar={member.avatar} size={32} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.body}>
                {member.name}
                {member.isSelf ? '（我）' : ''}
              </Text>
              <View
                testID="ranking-progress-track"
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.field,
                  marginVertical: 4,
                  overflow: 'hidden',
                }}
              >
                <View
                  testID="ranking-progress-fill"
                  style={{
                    height: '100%',
                    width: `${rankingProgress(member.count, activity.rankings[0]?.count ?? 0) * 100}%`,
                    backgroundColor: colors.primary,
                  }}
                />
              </View>
              {!member.isSelf && member.syncedAt ? (
                <Text style={styles.muted}>
                  已同步 {formatDate(member.syncedAt)}
                </Text>
              ) : null}
            </View>
            <Text style={styles.body}>{member.count} 次</Text>
          </View>
        ))}
        <Text style={styles.muted}>其他成员数据以最近同步结果为准</Text>
      </Panel>
      <Text accessibilityRole="header" style={styles.heading}>
        打卡足迹
      </Text>
      <Text style={styles.muted}>按打卡所属日期排列；撤销的打卡不会显示。</Text>
      {activity.timeline.length === 0 ? (
        <Text style={styles.muted}>这一周还没有打卡记录。</Text>
      ) : (
        <View style={{ paddingHorizontal: 4 }}>
          {activity.timeline.slice(0, visibleCount).map((entry, index) => {
            const recordedAt = new Date(entry.createdAt);
            const validTime = !Number.isNaN(recordedAt.getTime());
            const recordedLabel = !validTime
              ? entry.createdAt
              : recordedAt.toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                });
            const isBackfill = validTime && dateKey(recordedAt) !== entry.date;
            const startsDay =
              index === 0 || activity.timeline[index - 1].date !== entry.date;
            const continuesDay =
              index + 1 < visibleCount &&
              activity.timeline[index + 1]?.date === entry.date;
            return (
              <View key={`${entry.accountId}:${entry.id}`}>
                {startsDay ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginTop: index === 0 ? 8 : 16,
                      marginBottom: 16,
                    }}
                  >
                    <Text
                      testID="timeline-date-heading"
                      accessibilityRole="header"
                      style={[
                        styles.muted,
                        quiet && { color: colors.ink, fontWeight: '600' },
                      ]}
                    >
                      {timelineDateLabel(entry.date, now)}
                    </Text>
                    {quiet ? (
                      <View
                        testID="timeline-date-divider"
                        accessible={false}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        style={{
                          flex: 1,
                          height: 1,
                          marginLeft: 10,
                          backgroundColor: colors.border,
                        }}
                      />
                    ) : null}
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View
                    accessible={false}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={{ width: 24, alignItems: 'center' }}
                  >
                    {!startsDay ? (
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          height: 9,
                          width: quiet ? 1 : 2,
                          backgroundColor: quiet
                            ? '#B7C0B8'
                            : colors.primaryContainer,
                        }}
                      />
                    ) : null}
                    {!quiet || continuesDay ? (
                      <View
                        style={{
                          position: 'absolute',
                          top: 9,
                          bottom: 0,
                          width: quiet ? 1 : 2,
                          backgroundColor: quiet
                            ? '#B7C0B8'
                            : colors.primaryContainer,
                        }}
                      />
                    ) : null}
                    <View
                      style={{
                        width: quiet ? 11 : 12,
                        height: quiet ? 11 : 12,
                        marginTop: 4,
                        borderRadius: quiet ? 5.5 : 6,
                        backgroundColor: quiet
                          ? colors.background
                          : colors.primary,
                        ...(quiet
                          ? {
                              borderWidth: 2,
                              borderColor: colors.primary,
                            }
                          : {}),
                      }}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, paddingBottom: 24 }}>
                    <Text style={styles.body}>
                      {entry.name}
                      {entry.isSelf ? '（我）' : ''} 打卡了「{entry.taskName}」
                    </Text>
                    <Text style={[styles.muted, { marginTop: 6 }]}>
                      {recordedLabel} · 第 {entry.sequence} 次
                    </Text>
                    {isBackfill ? (
                      <Text style={styles.muted}>
                        补卡 · 操作于 {recordedAt.toLocaleDateString('zh-CN')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
          {visibleCount < activity.timeline.length ? (
            <ActionButton
              onPress={() => setVisibleCount((count) => count + 30)}
            >
              查看更多
            </ActionButton>
          ) : null}
        </View>
      )}
    </View>
  );
}
