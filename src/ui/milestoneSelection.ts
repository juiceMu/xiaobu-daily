import type { MilestoneGoal } from '../domain/types';

export function milestoneGroups(goals: MilestoneGoal[]) {
  const configured = goals.filter(
    (goal) => !goal.deleted && goal.startWeight !== null,
  );
  return {
    current: configured.filter((goal) => goal.archived !== true),
    archived: configured.filter((goal) => goal.archived === true),
  };
}
export function selectMilestone(
  goals: MilestoneGoal[],
  selectedId: string,
  search = '',
) {
  const visible = goals.filter((goal) =>
    goal.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return {
    visible,
    selected: visible.find((goal) => goal.id === selectedId) ?? visible[0],
  };
}
