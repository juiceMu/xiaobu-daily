import type { AppStore } from './store';
import type { ActionResult } from '../domain/types';

// 只由显式的开发预览操作调用，保存仍经过统一事务层。
export async function loadDemoHistory(store: AppStore): Promise<ActionResult> {
  const { hasDemoHistory, seedDemoHistory } =
    await import('../domain/demoData');
  const current = store.getSnapshot().state;
  if (current && hasDemoHistory(current))
    return { ok: true, message: '演示历史已存在，无需重复添加' };
  return store.run((draft) => seedDemoHistory(draft, new Date()));
}
