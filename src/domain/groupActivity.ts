import { dateKey, weekKey } from './engine';
import type { AppState, ProfileAvatar } from './types';

type Peer = {
  accountId: string;
  name: string;
  avatar?: ProfileAvatar;
  syncedAt: string;
  left: boolean;
  app: AppState;
};

export function rankingProgress(count: number, highest: number): number {
  return highest > 0 ? Math.max(0, Math.min(1, count / highest)) : 0;
}

export function timelineDateLabel(date: string, now: Date): string {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const shortDate = `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
  if (date === dateKey(now)) return `今天 · ${shortDate}`;
  if (date === dateKey(yesterday)) return `昨天 · ${shortDate}`;
  return date.slice(0, 4) === dateKey(now).slice(0, 4)
    ? shortDate
    : `${date.slice(0, 4)}年${shortDate}`;
}

export function getGroupActivity(
  state: AppState,
  peers: Peer[],
  selectedNow: Date,
) {
  const week = weekKey(selectedNow);
  const members = [
    {
      accountId: state.sync?.accountId ?? 'self',
      name: state.giftState?.profile.name || '我',
      avatar: state.giftState?.profile.avatar,
      syncedAt: null as string | null,
      isSelf: true,
      app: state,
    },
    ...peers
      .filter((peer) => !peer.left)
      .map((peer) => ({
        accountId: peer.accountId,
        name: peer.name,
        avatar: peer.avatar,
        syncedAt: peer.syncedAt as string | null,
        isSelf: false,
        app: peer.app,
      })),
  ];
  const rankings = members
    .map(({ app, ...member }) => ({
      ...member,
      count: app.checkins.filter((entry) => entry.week === week).length,
      rank: 0,
    }))
    .sort(
      (a, b) => b.count - a.count || a.accountId.localeCompare(b.accountId),
    );
  rankings.forEach((entry, index) => {
    entry.rank =
      index > 0 && rankings[index - 1].count === entry.count
        ? rankings[index - 1].rank
        : index + 1;
  });
  const timeline = members
    .flatMap(({ app, syncedAt: _syncedAt, ...member }) => {
      const sequences = new Map<string, number>();
      return app.checkins
        .filter((entry) => entry.week === week)
        .sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        )
        .map((entry) => {
          const key = JSON.stringify([entry.date, entry.taskId]);
          const sequence = (sequences.get(key) ?? 0) + 1;
          sequences.set(key, sequence);
          return {
            ...member,
            id: entry.id,
            date: entry.date,
            createdAt: entry.createdAt,
            sequence,
            taskName:
              app.tasks.find((task) => task.id === entry.taskId)?.name ??
              '已删除任务',
          };
        });
    })
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.createdAt.localeCompare(a.createdAt) ||
        a.accountId.localeCompare(b.accountId) ||
        a.id.localeCompare(b.id),
    );
  return {
    rankings,
    timeline,
    total: rankings.reduce((sum, item) => sum + item.count, 0),
  };
}
