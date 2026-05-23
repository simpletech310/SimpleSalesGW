"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";

type Qbr = {
  id: string;
  scheduledAt: string;
  completedAt: string | null;
};

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
      <Card>
        <form onSubmit={schedule} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Schedule next QBR</Label>
            <Input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-64"
            />
          </div>
          <Button type="submit" disabled={scheduling || !date}>
            {scheduling ? "Scheduling…" : "Schedule"}
          </Button>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 bg-gtn-lavender text-xs uppercase tracking-wide font-semibold text-gtn-navy">
          QBR history
        </div>
        {qbrs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gtn-grey-2 text-center">No QBRs scheduled yet.</p>
        ) : (
          <ul className="divide-y divide-gtn-lavender-2">
            {qbrs.map((q) => (
              <li key={q.id} className="px-4 py-3 text-sm flex items-center justify-between">
                <Link className="text-gtn-navy hover:underline" href={`/accounts/${customerId}/qbrs/${q.id}`}>
                  {format(new Date(q.scheduledAt), "PPPp")}
                </Link>
                <span className="text-xs text-gtn-grey-3">
                  {q.completedAt ? `completed ${format(new Date(q.completedAt), "PP")}` : "upcoming"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
