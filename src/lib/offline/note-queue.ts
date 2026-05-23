/**
 * IndexedDB-backed queue for offline note writes.
 * Notes are append-only and idempotent via clientId — safe to retry without dedup logic.
 *
 * Works alongside the Workbox BackgroundSyncPlugin which handles SW-level retry.
 * This module covers the *foreground* path: if the user is browsing the app while
 * offline, we enqueue + show a banner. On `online` event we drain.
 */

import { get, set } from "idb-keyval";

const KEY = "gateway.notes.queue.v1";

export type QueuedNote = {
  clientId: string;
  leadId: string;
  body: string;
  pinned: boolean;
  enqueuedAt: number;
};

async function readAll(): Promise<QueuedNote[]> {
  const raw = (await get<QueuedNote[]>(KEY)) ?? [];
  return Array.isArray(raw) ? raw : [];
}

async function writeAll(items: QueuedNote[]): Promise<void> {
  await set(KEY, items);
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueNote(input: { leadId: string; body: string; pinned?: boolean }): Promise<QueuedNote> {
  const note: QueuedNote = {
    clientId: uuid(),
    leadId: input.leadId,
    body: input.body,
    pinned: !!input.pinned,
    enqueuedAt: Date.now(),
  };
  const items = await readAll();
  items.push(note);
  await writeAll(items);
  return note;
}

export async function count(): Promise<number> {
  return (await readAll()).length;
}

export async function peek(): Promise<QueuedNote[]> {
  return readAll();
}

export async function clear(): Promise<void> {
  await writeAll([]);
}

/**
 * Attempt to POST each queued note. On 2xx, remove it from the queue.
 * Returns the new queue size.
 */
export async function drain(): Promise<{ remaining: number; flushed: number; failed: number }> {
  const items = await readAll();
  if (items.length === 0) return { remaining: 0, flushed: 0, failed: 0 };

  const kept: QueuedNote[] = [];
  let flushed = 0;
  let failed = 0;
  for (const note of items) {
    try {
      const res = await fetch(`/api/leads/${note.leadId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": note.clientId,
        },
        body: JSON.stringify({ body: note.body, pinned: note.pinned, clientId: note.clientId }),
      });
      if (res.ok || res.status === 409) {
        flushed += 1;
      } else {
        kept.push(note);
        failed += 1;
      }
    } catch {
      kept.push(note);
      failed += 1;
    }
  }
  await writeAll(kept);
  return { remaining: kept.length, flushed, failed };
}
