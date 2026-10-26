import type {
  ActionResult,
  AppState,
  DateInput,
  MilestoneIcon,
  MilestoneInput,
  SettingsInput,
  TaskInput,
  Ticket,
  TicketStatus,
  WeekStats,
} from './types';

export const MILESTONE_ICONS: readonly MilestoneIcon[];
export const DEFAULT_MILESTONE_ICON: MilestoneIcon;
export function numericInputError(
  input: unknown,
  kind: 'integer' | 'decimal',
  min: number,
  max: number,
): string;
export function dateKey(now?: DateInput): string;
export function weekKey(now?: DateInput): string;
export function createInitialState(now?: DateInput): AppState;
export function migrateState(saved: unknown): AppState;
export function getTaskCount(
  state: AppState,
  taskId: string,
  now?: DateInput,
): number;
export function getWeekStats(state: AppState, now?: DateInput): WeekStats;
export function checkIn(
  state: AppState,
  taskId: string,
  now?: DateInput,
  occurredDate?: string,
): ActionResult;
export function undoCheckIn(
  state: AppState,
  taskId: string,
  now?: DateInput,
  occurredDate?: string,
): ActionResult;
export function redeemTicket(
  state: AppState,
  now?: DateInput,
  occurredDate?: string,
): ActionResult;
export function redeemCompanionTicket(
  state: AppState,
  now?: DateInput,
  occurredDate?: string,
): ActionResult;
export function getTicketStatus(
  ticket: Ticket,
  state: AppState,
  now?: DateInput,
): TicketStatus;
export function useTicket(
  state: AppState,
  ticketId: string,
  now?: DateInput,
  note?: string,
): ActionResult;
export function configureWeightGoal(
  state: AppState,
  startWeight: number | string,
  now?: DateInput,
): ActionResult;
export function configureMilestoneGoal(
  state: AppState,
  input: MilestoneInput,
): ActionResult;
export function addMilestoneGoal(
  state: AppState,
  input: MilestoneInput,
): ActionResult;
export function updateMilestoneGoal(
  state: AppState,
  id: string,
  input: MilestoneInput,
): ActionResult;
export function updateMilestoneIcon(
  state: AppState,
  id: string,
  icon: MilestoneIcon,
): ActionResult;
export function deleteMilestoneGoal(state: AppState, id: string): ActionResult;
export function archiveMilestoneGoal(state: AppState, id: string): ActionResult;
export function restoreMilestoneGoal(state: AppState, id: string): ActionResult;
export function setMilestoneEnabled(
  state: AppState,
  id: string,
  enabled: boolean,
): ActionResult;
export function recordWeight(
  state: AppState,
  value: number | string,
  now?: DateInput,
): ActionResult;
export function recordMilestoneValue(
  state: AppState,
  id: string,
  value: number | string,
  now?: DateInput,
): ActionResult;
export function disableWeightGoal(state: AppState): ActionResult;
export function addTask(state: AppState, input: TaskInput): ActionResult;
export function updateTask(
  state: AppState,
  id: string,
  input: Partial<TaskInput>,
): ActionResult;
export function archiveTask(state: AppState, id: string): ActionResult;
export function restoreTask(state: AppState, id: string): ActionResult;
export function deleteTask(state: AppState, id: string): ActionResult;
export function updateSettings(
  state: Pick<AppState, 'settings'>,
  input: SettingsInput,
): ActionResult;
