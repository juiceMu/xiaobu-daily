import type { AppState } from '../domain/types';

const MAX_ROUNDS = 3;

function records(state: AppState) {
  return state.tickets.flatMap((ticket) => ticket.companionUses ?? []);
}

export function hasPendingCompanionUse(state: AppState): boolean {
  return records(state).some(
    (session) => session.stage !== 'completed' && session.stage !== 'cancelled',
  );
}

// 一轮交换使用固定快照；最多再交换两轮，送出提交决定和完成回执。
export async function syncCompanionRounds(
  getState: () => AppState | null,
  exchange: (state: AppState) => Promise<void>,
): Promise<number> {
  const initial = getState();
  const groupId =
    initial?.groupLink?.groupId ?? initial?.pendingGroupDeparture?.groupId;
  const accountId = initial?.sync?.accountId;
  let rounds = 0;
  while (rounds < MAX_ROUNDS) {
    const before = getState();
    if (
      !before ||
      !accountId ||
      before.sync?.accountId !== accountId ||
      (before.groupLink?.groupId ?? before.pendingGroupDeparture?.groupId) !==
        groupId
    ) {
      throw new Error('小组或本机身份已变化，请重新同步');
    }
    const previous = JSON.stringify(records(before));
    await exchange(before);
    rounds += 1;
    const after = getState();
    if (!after) throw new Error('本地数据尚未就绪');
    const sessions = records(after);
    const waitingForDecision = sessions.some(
      (session) =>
        session.stage === 'accepted' || session.stage === 'committed',
    );
    if (!waitingForDecision && previous === JSON.stringify(sessions)) break;
  }
  return rounds;
}
