export const GROUP_VIEW_KEY = 'small-steps-group-view-v1';
export type GroupViewMode = 'self' | 'group';
export function isGroupViewMode(value: unknown): value is GroupViewMode {
  return value === 'self' || value === 'group';
}
export function parseGroupView(raw: string | null): GroupViewMode {
  if (raw === null) return 'self';
  try {
    const parsed: unknown = JSON.parse(raw);
    return isGroupViewMode(parsed) ? parsed : 'self';
  } catch {
    return 'self';
  }
}
export function createGroupViewRepository(storage: {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
}) {
  return {
    async load(): Promise<GroupViewMode> {
      return parseGroupView(await storage.getItem(GROUP_VIEW_KEY));
    },
    async save(mode: GroupViewMode): Promise<void> {
      if (!isGroupViewMode(mode)) throw new Error('请选择只看自己或看全组');
      await storage.setItem(GROUP_VIEW_KEY, JSON.stringify(mode));
    },
  };
}
