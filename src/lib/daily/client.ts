/**
 * v2.22 — Daily.co API wrapper.
 *
 * Server-only. Used by /api/leads/[id]/calls/start to create a room +
 * issue per-participant meeting tokens for the rep (owner) and the
 * customer guest. Recording is not enabled in v2.22 (test/demo plan
 * doesn't support it); webhook handler is stubbed for v2.23 plug-in.
 */

import { env } from "@/lib/env";

const DAILY_BASE = "https://api.daily.co/v1";

export class DailyNotConfiguredError extends Error {
  constructor() {
    super("DAILY_API_KEY is not configured");
    this.name = "DailyNotConfiguredError";
  }
}

function authHeaders(): HeadersInit {
  const key = env().DAILY_API_KEY;
  if (!key) throw new DailyNotConfiguredError();
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export type CreateRoomInput = {
  /** Room name. Daily requires unique; we generate one per session. */
  name: string;
  /** Optional: video / audio defaults, etc. */
  properties?: Record<string, unknown>;
};

export type DailyRoom = {
  id: string;
  name: string;
  url: string;
  privacy: "public" | "private";
};

/**
 * Create a Daily room. Defaults: private (token-gated), 2h auto-expiry
 * from now, eject participants when the room is deleted.
 */
export async function createRoom(input: CreateRoomInput): Promise<DailyRoom> {
  const expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 2; // 2h
  const res = await fetch(`${DAILY_BASE}/rooms`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      name: input.name,
      privacy: "private",
      properties: {
        exp: expiry,
        enable_chat: true,
        enable_screenshare: true,
        start_video_off: false,
        start_audio_off: false,
        ...(input.properties ?? {}),
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daily createRoom failed (${res.status}): ${text}`);
  }
  return (await res.json()) as DailyRoom;
}

/** Delete a room (cleanup on call end). Silent on 404. */
export async function deleteRoom(name: string): Promise<void> {
  const res = await fetch(`${DAILY_BASE}/rooms/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Daily deleteRoom failed (${res.status}): ${text}`);
  }
}

export type MeetingTokenInput = {
  roomName: string;
  /** Display name in the call UI. */
  userName: string;
  /** Owner = can boot participants + start/stop recording when paid plan. */
  isOwner?: boolean;
  /** Token lifetime in seconds. Defaults to 2h. */
  expSeconds?: number;
};

/** Create a short-lived meeting token for a single participant. */
export async function createMeetingToken(input: MeetingTokenInput): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + (input.expSeconds ?? 60 * 60 * 2);
  const res = await fetch(`${DAILY_BASE}/meeting-tokens`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      properties: {
        room_name: input.roomName,
        user_name: input.userName,
        is_owner: Boolean(input.isOwner),
        exp: expiry,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daily createMeetingToken failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

/** Generate a room name from a leadId + timestamp (URL-safe). */
export function newRoomName(leadId: string): string {
  // Daily room names must be alphanumeric + hyphens, max 41 chars.
  // Use the first 8 chars of leadId + timestamp slice.
  const short = leadId.replace(/-/g, "").slice(0, 8);
  const ts = Date.now().toString(36);
  return `gtn-${short}-${ts}`;
}
