export function formatMilestoneSource(name?: string) {
  if (!name) return '里程碑';
  return name.endsWith('里程碑') ? name : `${name}里程碑`;
}
