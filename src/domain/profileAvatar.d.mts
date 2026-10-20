import type { ProfileAvatar } from './types';
export const AVATAR_PRESETS: readonly ['sprout', 'sun', 'moon', 'flower'];
export const MAX_AVATAR_BYTES: number;
export function validProfileAvatar(avatar: unknown): avatar is ProfileAvatar;
