import type {
  ActionResult,
  AppState,
  DateInput,
  GiftEnvelope,
  GiftIdentity,
  GiftInput,
  GiftReceipt,
  LocalProfile,
} from './types';
export function ensureGiftProfile(
  state: AppState,
  profile: GiftIdentity,
): ActionResult;
export function updateLocalProfile(
  state: AppState,
  profile: LocalProfile & { avatar: NonNullable<LocalProfile['avatar']> },
): ActionResult;
export function createGift(
  state: AppState,
  input: GiftInput,
  ids: { giftId: string; ticketId: string },
  now?: DateInput,
): ActionResult;
export function exportGift(envelope: GiftEnvelope): string;
export function parseGift(raw: string, now?: DateInput): GiftEnvelope;
export function previewGift(
  state: AppState,
  raw: string,
  now?: DateInput,
): ActionResult;
export function receiveGift(
  state: AppState,
  envelope: GiftEnvelope,
  now?: DateInput,
): ActionResult;
export function recordGiftReceipt(
  state: AppState,
  receipt: GiftReceipt,
  now?: DateInput,
): ActionResult;
export function exportGiftReceipt(receipt: GiftReceipt): string;
export function parseGiftReceipt(raw: string): GiftReceipt;
export function validateGiftState(state: AppState): boolean;
