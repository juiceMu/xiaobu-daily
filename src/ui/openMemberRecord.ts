/** 仅在入口仍有效且查看方式保存成功后进入成员只读详情。 */
export async function openMemberRecord(
  selectGroup: () => Promise<boolean>,
  isCurrent: () => boolean,
  navigate: () => void,
  onFailure: () => void,
): Promise<void> {
  let selected = false;
  try {
    selected = await selectGroup();
  } catch {
    selected = false;
  }
  if (!isCurrent()) return;
  if (!selected) {
    onFailure();
    return;
  }
  navigate();
}
