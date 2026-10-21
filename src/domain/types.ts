import type { ICON_OPTIONS } from './iconCatalog.mjs';

export type DateInput = Date | string | number;
export type MilestoneDirection = 'increase' | 'decrease';
export type MilestoneIcon = (typeof ICON_OPTIONS)[number][0];

export interface Task {
  id: string;
  name: string;
  icon: string;
  color: string;
  target: number;
  archived: boolean;
  deleted?: boolean;
}

export interface Checkin {
  id: string;
  taskId: string;
  date: string;
  week: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  name: string;
  createdAt: string;
  week: string;
  expiresAt: string | null;
  usedAt: string | null;
  usageNote?: string;
  source?: 'checkin' | 'weight' | 'gift';
  giftId?: string;
  senderId?: string;
  senderName?: string;
  milestone?: number;
  goalId?: string;
  goalName?: string;
  unit?: string;
  goalIcon?: MilestoneIcon;
}

export interface MilestoneEntry {
  id: string;
  date: string;
  weight: number;
  createdAt: string;
}

export interface MilestoneGoal {
  id: string;
  name: string;
  unit: string;
  direction: MilestoneDirection;
  step: number;
  startWeight: number | null;
  enabled: boolean;
  archived?: boolean;
  deleted?: boolean;
  icon?: MilestoneIcon;
  entries: MilestoneEntry[];
  unlockedMilestones: number[];
}

export interface Settings {
  threshold: number;
  rewardName: string;
  expiryEnabled: boolean;
  expiryDay: number;
  expiryTime: string;
}

export interface AppState {
  version: 4;
  tasks: Task[];
  checkins: Checkin[];
  tickets: Ticket[];
  redemptions: { id: string; week: string; cost: number; ticketId: string }[];
  weight: MilestoneGoal;
  milestoneGoals: MilestoneGoal[];
  settings: Settings;
  giftState?: GiftState;
  sync?: SyncState;
  storageVersion?: 1;
}

export type SyncEntityType =
  | 'tasks'
  | 'checkins'
  | 'tickets'
  | 'redemptions'
  | 'goals'
  | 'goalEntries'
  | 'settings'
  | 'profile'
  | 'gifts'
  | 'receipts';
export interface SyncEntity {
  entityType: SyncEntityType;
  entityId: string;
  ownerId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  payload: string;
}
export interface SyncOperation {
  operationId: string;
  transactionId: string;
  deviceId: string;
  accountId: string;
  baseRevision: number;
  entityRevision: number;
  entity: SyncEntity;
}
export interface SyncState {
  schemaVersion: 1;
  dataVersion: 4;
  accountId: string;
  deviceId: string;
  entities: Record<string, SyncEntity>;
  outbox: SyncOperation[];
  attachments: Record<string, string>;
  sequence: number;
  acknowledged: Record<string, string>;
}
export interface PersistedAppState extends AppState {
  storageVersion: 1;
  sync: SyncState;
}

export type State = AppState;

export interface ActionResult {
  ok: boolean;
  message: string;
  ticket?: Ticket;
  goal?: MilestoneGoal;
  milestones?: number[];
  gift?: GiftEnvelope;
  receipt?: GiftReceipt;
}

export interface GiftIdentity {
  id: string;
  name: string;
}
export type AvatarPreset = 'sprout' | 'sun' | 'moon' | 'flower';
export type ProfileAvatar =
  { kind: 'preset'; id: AvatarPreset } | { kind: 'image'; dataUri: string };
export interface LocalProfile extends GiftIdentity {
  avatar?: ProfileAvatar;
}
export interface GiftEnvelope {
  version: 1;
  kind: 'small-steps-gift';
  giftId: string;
  ticketId: string;
  name: string;
  issuedAt: string;
  expiresAt: string | null;
  issuer: GiftIdentity;
  recipientId?: string;
}
export interface GiftReceipt {
  version: 1;
  kind: 'small-steps-gift-receipt';
  giftId: string;
  ticketId: string;
  senderId: string;
  recipient: GiftIdentity;
  receivedAt: string;
  gift: GiftEnvelope;
}
export interface GiftState {
  profile: LocalProfile;
  outgoing: GiftEnvelope[];
  received: GiftReceipt[];
  receipts: GiftReceipt[];
}
export interface GiftInput {
  name: string;
  validity: 'week' | 'permanent';
  recipientId?: string;
}
// 将来云端传输实现接在此边界，离线实现不提供签名或账号验证。
export interface GiftTransport {
  publish(envelope: GiftEnvelope): Promise<string>;
  resolve(payload: string): Promise<GiftEnvelope>;
  acknowledge(receipt: GiftReceipt): Promise<void>;
}
export interface GiftService {
  preview(state: AppState, payload: string, now: DateInput): ActionResult;
  receive(
    state: AppState,
    envelope: GiftEnvelope,
    now: DateInput,
  ): ActionResult;
}

export interface WeekStats {
  total: number;
  spent: number;
  available: number;
  redeemable: number;
  remainder: number;
  days: { date: string; count: number }[];
}

export interface TaskInput {
  name: string;
  target: number | string;
  icon?: string;
  color?: string;
}

export interface MilestoneInput {
  name: string;
  unit: string;
  direction: MilestoneDirection;
  step: number | string;
  startWeight: number | string;
  icon?: MilestoneIcon;
}

export type SettingsInput = Partial<
  Omit<Settings, 'threshold' | 'expiryDay'>
> & {
  threshold?: number | string;
  expiryDay?: number | string;
};

export type TicketStatus = 'available' | 'used' | 'expired';
