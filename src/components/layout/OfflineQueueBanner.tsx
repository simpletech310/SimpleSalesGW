"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { count, drain } from "@/lib/offline/note-queue";

/**
 * Shows the offline-queue badge in the app shell.
 * Auto-drains when:
 *   - the browser fires `online`
 *   - the user clicks the banner
 *   - on first mount (in case the user reopens the app online)
 */
export function OfflineQueueBanner() {
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      setPending(await count());
    } catch {
      /* ignore */
    }
  }, []);

  const tryDrain = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await drain();
      setPending(result.remaining);
      if (result.flushed > 0) {
        toast.success(`Synced ${result.flushed} note${result.flushed === 1 ? "" : "s"}`);
      }
    } finally {
      setBusy(false);
    }
  }, [busy]);

  useEffect(() => {
    void refreshCount();
    void tryDrain();
    const onOnline = () => { void tryDrain(); };
    const onStorage = () => { void refreshCount(); };
    window.addEventListener("online", onOnline);
    window.addEventListener("storage", onStorage);
    const interval = window.setInterval(refreshCount, 8000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, [refreshCount, tryDrain]);

  if (pending === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void tryDrain()}
      className="inline-flex items-center gap-2 rounded-full bg-gtn-amber text-white text-xs font-medium px-3 py-1 hover:opacity-90"
      title="Click to retry sync"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-white animate-pulse" />
      {pending} queued offline
    </button>
  );
}
