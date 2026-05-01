// components/call-room/types.ts

export type AvatarMode = 'photo' | 'initials' | 'default_male' | 'default_female';

export type TimeOfDayState = 'dawn' | 'day' | 'dusk' | 'night';

export type CallStatus =
  | 'idle'
  | 'dialing'
  | 'ringing'
  | 'connected'
  | 'on_hold'
  | 'transferring'
  | 'ended';

export interface ClientContext {
  id: string;
  name: string | null;
  phoneE164: string;
  photoUrl: string | null;
  avatarMode: AvatarMode;
  service: string | null;
  urgency: 'low' | 'medium' | 'high' | null;
  note: string | null;
}

export interface CallState {
  status: CallStatus;
  startedAt: number | null; // epoch ms
  hostAgent: { id: string; name: string; photoUrl: string | null };
  client: ClientContext;
  isMuted: boolean;
  isOnHold: boolean;
}

export interface RoomLight {
  /** 0 (left edge) → 1 (right edge) */
  x: number;
  /** 0 (top) → 1 (bottom) */
  y: number;
  /** CSS color string */
  color: string;
  /** 0 → 1 */
  intensity: number;
}
