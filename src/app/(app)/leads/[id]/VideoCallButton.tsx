"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Video, PhoneCall, X, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * v2.22 — Start an in-portal Daily.co video/audio call from the lead detail page.
 *
 * Click → POST /calls/start → opens Daily Prebuilt in a fullscreen iframe.
 * Guest URL is copyable so the rep can share it with the customer.
 * Closing the modal POSTs /calls/end with computed duration.
 */
export function VideoCallButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState<"VIDEO_CALL" | "AUDIO_CALL" | null>(null);
  const [session, setSession] = useState<{
    sessionId: string;
    repIframeUrl: string;
    guestUrl: string;
    startedAt: number;
  } | null>(null);

  async function start(kind: "VIDEO_CALL" | "AUDIO_CALL") {
    setStarting(kind);
    try {
      const res = await fetch(`/api/leads/${leadId}/calls/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? "Could not start call"); return; }
      const url = new URL(data.roomUrl);
      url.searchParams.set("t", data.repToken);
      setSession({
        sessionId: data.sessionId,
        repIframeUrl: url.toString(),
        guestUrl: data.guestUrl,
        startedAt: Date.now(),
      });
      toast.success(`${kind === "AUDIO_CALL" ? "Audio" : "Video"} call ready — share guest URL with the customer`);
    } finally { setStarting(null); }
  }

  async function end() {
    if (!session) return;
    const durationSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
    await fetch(`/api/leads/${leadId}/calls/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.sessionId, durationSeconds }),
    }).catch(() => { /* best-effort */ });
    setSession(null);
    router.refresh();
  }

  // Auto-end on tab close / navigate-away
  useEffect(() => {
    if (!session) return;
    const handler = () => { void end(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId]);

  async function copyGuest() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.guestUrl);
      toast.success("Guest link copied");
    } catch {
      toast.error("Copy failed — select manually");
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => start("VIDEO_CALL")}
          disabled={starting !== null || session !== null}
        >
          {starting === "VIDEO_CALL" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Video className="h-3.5 w-3.5 mr-1" />}
          Video call
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => start("AUDIO_CALL")}
          disabled={starting !== null || session !== null}
        >
          {starting === "AUDIO_CALL" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <PhoneCall className="h-3.5 w-3.5 mr-1" />}
          Audio call
        </Button>
      </div>

      {session && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-white">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-gtn-navy">Call in progress</span>
              <span className="text-xs text-gtn-grey-2 truncate">Share with customer:</span>
              <code className="gtn-code-pill text-xs truncate max-w-md">{session.guestUrl}</code>
              <Button size="sm" variant="ghost" onClick={copyGuest}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy
              </Button>
            </div>
            <Button size="sm" variant="destructive" onClick={end}>
              <X className="h-3.5 w-3.5 mr-1" /> End call
            </Button>
          </div>
          <iframe
            src={session.repIframeUrl}
            allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
            className="flex-1 w-full bg-black border-0"
          />
        </div>
      )}
    </>
  );
}
