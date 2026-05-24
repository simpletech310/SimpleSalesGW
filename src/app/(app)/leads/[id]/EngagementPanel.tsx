"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DoorOpen, ShieldX, CalendarCheck, ThumbsDown, Clock, Loader2 } from "lucide-react";
import { ActivityType, ActivityOutcome } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

const QUICK_ACTIONS = [
  { type: ActivityType.DOOR_KNOCK, label: "Door knocked", icon: DoorOpen, outcome: ActivityOutcome.NEUTRAL, subject: "Door knocked" },
  { type: ActivityType.GATEKEEPER_REJECTED, label: "Gatekeeper rejected", icon: ShieldX, outcome: ActivityOutcome.NEGATIVE, subject: "Gatekeeper rejected" },
  { type: ActivityType.MEETING_SET, label: "Meeting set", icon: CalendarCheck, outcome: ActivityOutcome.POSITIVE, subject: "Meeting set" },
  { type: ActivityType.NOT_INTERESTED, label: "Not interested", icon: ThumbsDown, outcome: ActivityOutcome.NEGATIVE, subject: "Not interested" },
  { type: ActivityType.FOLLOW_UP_SCHEDULED, label: "Follow-up", icon: Clock, outcome: ActivityOutcome.NEUTRAL, subject: "Follow-up scheduled" },
];

/**
 * v2.22 — Engagement quick-action panel on the lead detail page.
 *
 * One click logs an Activity with the matching ActivityType + outcome.
 * Optional note field for context. Manager sees the same panel.
 */
export function EngagementPanel({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busyType, setBusyType] = useState<ActivityType | null>(null);

  async function fire(type: ActivityType, outcome: ActivityOutcome, subject: string) {
    setBusyType(type);
    try {
      const res = await fetch(`/api/leads/${leadId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          subject: note.trim() ? `${subject}: ${note.trim().slice(0, 200)}` : subject,
          body: note.trim() || undefined,
          outcome,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? "Log failed"); return; }
      toast.success(subject);
      setNote("");
      router.refresh();
    } finally { setBusyType(null); }
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gtn-navy mb-1">Engagement quick-log</h3>
      <p className="text-xs text-gtn-grey-2 mb-3">One click writes an activity. Optional note for context.</p>
      <div className="space-y-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional 1-line note…" />
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            const busy = busyType === a.type;
            return (
              <button
                key={a.type}
                type="button"
                onClick={() => fire(a.type, a.outcome, a.subject)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gtn-lavender-2 bg-white text-sm hover:border-gtn-purple/50 hover:bg-gtn-lavender/30 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5 text-gtn-purple" />}
                {a.label}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
