"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";

type Attendee = { name: string; role?: string; email?: string };
type AgendaItem = { title: string; notes?: string };
type FollowUp = { description: string; ownerUserId?: string | null; dueAt?: string | null };

type Qbr = {
  id: string;
  scheduledAt: string;
  completedAt: string | null;
  attendees: Attendee[];
  agenda: AgendaItem[];
  outcomes: string | null;
  followUps: FollowUp[];
};

export function QbrEditor({ customerId, customerName, qbr }: { customerId: string; customerName: string; qbr: Qbr }) {
  const router = useRouter();
  const [agenda, setAgenda] = useState<AgendaItem[]>(qbr.agenda);
  const [outcomes, setOutcomes] = useState(qbr.outcomes ?? "");
  const [followUps, setFollowUps] = useState<FollowUp[]>(qbr.followUps);
  const [saving, setSaving] = useState(false);
  const isCompleted = !!qbr.completedAt;

  async function save(markCompleted: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/qbrs/${qbr.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agenda,
          outcomes: outcomes || null,
          followUps,
          completed: markCompleted ? true : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Save failed");
      } else {
        toast.success(markCompleted ? "QBR completed" : "Saved");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <Link className="text-sm text-gtn-purple underline" href={`/accounts/${customerId}`}>← {customerName}</Link>
        <h1 className="text-2xl font-bold text-gtn-navy mt-2">QBR · {format(new Date(qbr.scheduledAt), "PPPp")}</h1>
        {isCompleted && (
          <p className="text-xs text-gtn-green mt-1">✓ Completed {format(new Date(qbr.completedAt!), "PPp")}</p>
        )}
      </div>

      <Card>
        <h2 className="text-sm font-semibold mb-2">Attendees</h2>
        {qbr.attendees.length === 0 ? (
          <p className="text-sm text-gtn-grey-2">None recorded.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {qbr.attendees.map((a, i) => (
              <li key={i}>{a.name}{a.role ? ` — ${a.role}` : ""}{a.email ? ` <${a.email}>` : ""}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold mb-2">Agenda</h2>
        <ul className="space-y-2">
          {agenda.map((item, i) => (
            <li key={i} className="space-y-1">
              <Input
                value={item.title}
                onChange={(e) => setAgenda((cur) => cur.map((it, idx) => (idx === i ? { ...it, title: e.target.value } : it)))}
                disabled={isCompleted}
              />
              <Textarea
                value={item.notes ?? ""}
                onChange={(e) => setAgenda((cur) => cur.map((it, idx) => (idx === i ? { ...it, notes: e.target.value } : it)))}
                placeholder="Discussion notes…"
                rows={2}
                disabled={isCompleted}
              />
            </li>
          ))}
        </ul>
        {!isCompleted && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => setAgenda((cur) => [...cur, { title: "New item" }])}
          >
            + Add agenda item
          </Button>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold mb-2">Outcomes</h2>
        <Textarea
          value={outcomes}
          onChange={(e) => setOutcomes(e.target.value)}
          placeholder="Decisions reached, action items, notable shifts…"
          rows={6}
          disabled={isCompleted}
        />
      </Card>

      <Card>
        <h2 className="text-sm font-semibold mb-2">Follow-ups</h2>
        <p className="text-xs text-gtn-grey-2 mb-3">
          Marked complete on this page → each follow-up becomes a STEADY_STATE onboarding task.
        </p>
        <ul className="space-y-3">
          {followUps.map((f, i) => (
            <li key={i} className="border-l-4 border-gtn-purple pl-3 space-y-2">
              <Input
                value={f.description}
                onChange={(e) => setFollowUps((cur) => cur.map((it, idx) => (idx === i ? { ...it, description: e.target.value } : it)))}
                disabled={isCompleted}
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Due</Label>
                  <Input
                    type="date"
                    value={f.dueAt ? f.dueAt.slice(0, 10) : ""}
                    onChange={(e) => setFollowUps((cur) => cur.map((it, idx) => (idx === i ? { ...it, dueAt: e.target.value ? new Date(e.target.value).toISOString() : null } : it)))}
                    disabled={isCompleted}
                  />
                </div>
                {!isCompleted && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="self-end"
                    onClick={() => setFollowUps((cur) => cur.filter((_, idx) => idx !== i))}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {!isCompleted && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => setFollowUps((cur) => [...cur, { description: "" }])}
          >
            + Add follow-up
          </Button>
        )}
      </Card>

      {!isCompleted && (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={saving} onClick={() => save(false)}>
            {saving ? "Saving…" : "Save draft"}
          </Button>
          <Button disabled={saving} onClick={() => save(true)}>
            {saving ? "Completing…" : "Mark complete"}
          </Button>
        </div>
      )}
    </div>
  );
}
