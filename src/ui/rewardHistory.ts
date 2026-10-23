import type { MilestoneGoal, Ticket } from '../domain/types';

export interface UsedTicketWeek {
  key: string;
  title: string;
  tickets: Ticket[];
}
const localDate = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
export function groupUsedTickets(tickets: Ticket[]): UsedTicketWeek[] {
  const groups = new Map<string, UsedTicketWeek>();
  for (const ticket of [...tickets]
    .filter((item) => item.usedAt && Number.isFinite(Date.parse(item.usedAt)))
    .sort((a, b) => Date.parse(b.usedAt!) - Date.parse(a.usedAt!))) {
    const start = new Date(ticket.usedAt!);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const key = localDate(start);
    if (!groups.has(key))
      groups.set(key, {
        key,
        title: localDate(start) + ' — ' + localDate(end),
        tickets: [],
      });
    groups.get(key)!.tickets.push(ticket);
  }
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}
export type TicketListRow =
  | { type: 'week'; key: string; title: string; count: number }
  | {
      type: 'member';
      key: string;
      personId: string;
      name: string;
      count: number;
    }
  | { type: 'ticket'; key: string; ticket: Ticket };
export function usedTicketRows(tickets: Ticket[]): TicketListRow[] {
  return groupUsedTickets(tickets).flatMap((week): TicketListRow[] => [
    {
      type: 'week',
      key: 'week-' + week.key,
      title: week.title,
      count: week.tickets.length,
    },
    ...week.tickets.map((ticket): TicketListRow => ({
      type: 'ticket',
      key: ticket.id,
      ticket,
    })),
  ]);
}
export function unlockedRewards(goal: MilestoneGoal): number[] {
  return [...goal.unlockedMilestones].reverse();
}
