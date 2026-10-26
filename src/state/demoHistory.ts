import type { AppStore } from './store';
import type { ActionResult } from '../domain/types';

// 只由显式的开发预览操作调用，保存仍经过统一事务层。
export async function loadDemoHistory(store: AppStore): Promise<ActionResult> {
  return populateDemoHistory(store.run, () => store.getSnapshot().state);
}

// 设置入口与开发URL共用流程；每一步单独保存，失败后再次添加可继续。
export async function populateDemoHistory(
  run: AppStore['run'],
  getState: () => ReturnType<AppStore['getSnapshot']>['state'],
  now = new Date(),
): Promise<ActionResult> {
  const {
    hasDemoHistory,
    seedDemoHistory,
    hasCompanionDemoHistory,
    seedCompanionDemoHistory,
  } = await import('../domain/demoData');
  const current = getState();
  if (!current) return { ok: false, message: '本地数据尚未就绪' };
  if (!hasDemoHistory(current) || (!current.groupLink && !current.groupOwned)) {
    const result = await run((draft) => seedDemoHistory(draft, now));
    if (!result.ok) return result;
  }
  if (getState()?.groupLink?.groupId !== 'demo-group-0001')
    return {
      ok: true,
      message: '已保留原有小组；完整同行券样例需在演示小组的独立存档查看',
    };
  for (let round = 0; round < 2; round += 1) {
    const state = getState();
    if (state && hasCompanionDemoHistory(state))
      return {
        ok: true,
        message: '演示奖券已就绪，可查看可用、已使用及已过期同行券',
      };
    const result = await run((draft) => seedCompanionDemoHistory(draft, now));
    if (!result.ok)
      return {
        ok: false,
        message: `演示补充未完成，已保存步骤保留，请再次添加继续：${result.message}`,
      };
  }
  return {
    ok: true,
    message: '已补充可用、已使用、已过期同行券及共同用途记录',
  };
}
