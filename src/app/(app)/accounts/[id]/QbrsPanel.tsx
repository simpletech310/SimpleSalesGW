"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import { Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/help/EmptyState";

type Qbr = {
  id: string;
  scheduledAt: string;
  completedAt: string | null;
};

/**
 * v3.1.4 — QBRs panel on v3 tokens. Branded EmptyState + Badge for status.
 */
export function QbrsPanel({ customerId, qbrs }: { customerId: string; qbrs: Qbr[] }) {
  const router = useRouter();
  const [scheduling, setScheduling] = useState(false);
  const [date, setDate] = useState("");

  async function schedule(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setScheduling(true);
    try {
      const res = await fetch(`/api/accounts/${customerId}/qbrs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: new Date(date).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed");
      } else {
        toast.success("QBR scheduled");
        setDate("");
        router.refresh();
      }
    } finally {
      setScheduling(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Scheduler */}
      <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
        <form onSubmit={schedule} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 flex-1 min-w-[240px]">
            <Label htmlFor="qbr-date">Schedule next QBR</Label>
            <Input
              id="qbr-date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={scheduling || !date} size="sm">
            {scheduling && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {scheduling ? "Scheduling…" : "Schedule"}
          </Button>
        </form>
      </div>

      {/* History */}
      <div className="rounded-xl bg-surface border border-line-subtle overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-2 border-b border-line-subtle">
          <h3 className="ui-label">QBR history</h3>
        </div>
        {qbrs.length === 0 ? (
          <div className="px-4 py-2">
            <EmptyState
              Icon={Calendar}
              title="No QBRs scheduled yet"
              body="Quarterly business reviews are the rhythm of the relationship — schedule the first one above to set the cadence."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {qbrs.map((q) => {
              const isCompleted = Boolean(q.completedAt);
              const overdue = !isCompleted && isPast(new Date(q.scheduledAt));
              return (
                <li
                  key={q.id}
                  className="px-4 py-3 text-sm flex items-center justify-between gap-3 hover:bg-surface-3/30 transition-colors"
                >
                  <Link
                    className="text-ink-strong hover:text-gtn-purple font-medium min-w-0 truncate"
                    href={`/accounts/${customerId}/qbrs/${q.id}`}
                  >
                    {format(new Date(q.scheduledAt), "PPPp")}
                  </Link>
                  {isCompleted ? (
                    <Badge tone="success" shape="pill" size="xs" dot>
                      completed {format(new Date(q.completedAt!), "MMM d")}
                    </Badge>
                  ) : overdue ? (
                    <Badge tone="danger" shape="pill" size="xs" dot>overdue</Badge>
                  ) : (
                    <Badge tone="brand" shape="pill" size="xs" dot>upcoming</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
