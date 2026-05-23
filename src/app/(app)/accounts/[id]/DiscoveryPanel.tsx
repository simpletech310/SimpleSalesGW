"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { DiscoveryKind } from "@prisma/client";

type Assessment = {
  id: string;
  kind: DiscoveryKind;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  startedAt: string | null;
  completedAt: string | null;
  createdByName: string;
};

const KIND_LABEL: Record<DiscoveryKind, string> = {
  SITE_SURVEY: "MSP Site Survey",
  AI_READINESS: "AI Readiness Questionnaire",
  NIST_CSF: "NIST CSF 2.0 Self-Assessment",
  NIST_800_171: "NIST 800-171 / CMMC Readiness",
};

const KIND_BLURB: Record<DiscoveryKind, string> = {
  SITE_SURVEY: "Inventory of sites, identity, endpoints, backups, security stack, and compliance obligations.",
  AI_READINESS: "Org readiness 0-4 scorecard plus a prioritized use-case catalog and 30/60/90 roadmap.",
  NIST_CSF: "All 106 NIST CSF 2.0 Subcategories scored Tier 1-4 with rolled-up Category + Function summary, gap list, and remediation roadmap.",
  NIST_800_171: "110 NIST 800-171 Rev 2 controls × 14 families. Produces SPRS score, POAM register, and SSP draft for CMMC Level 2/3 readiness.",
};

export function DiscoveryPanel({
  customerId,
  assessments,
}: {
  customerId: string;
  assessments: Assessment[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState<DiscoveryKind | null>(null);

  async function startDiscovery(kind: DiscoveryKind) {
    setCreating(kind);
    try {
      const res = await fetch(`/api/accounts/${customerId}/discovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to start");
        return;
      }
      router.push(`/accounts/${customerId}/discovery/${data.assessment.id}`);
    } finally {
      setCreating(null);
    }
  }

  const kinds: DiscoveryKind[] = ["SITE_SURVEY", "AI_READINESS", "NIST_CSF", "NIST_800_171"];

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        {kinds.map((kind) => {
          const inProgress = assessments.find((a) => a.kind === kind && a.status === "IN_PROGRESS");
          const completed = assessments.find((a) => a.kind === kind && a.status === "COMPLETED");
          return (
            <Card key={kind} className="flex flex-col gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gtn-grey-2">{kind.replace(/_/g, " ")}</p>
                <h3 className="text-sm font-semibold text-gtn-navy mt-1">{KIND_LABEL[kind]}</h3>
                <p className="text-xs text-gtn-grey-2 mt-1">{KIND_BLURB[kind]}</p>
              </div>
              <div className="flex flex-wrap gap-2 mt-auto">
                {inProgress ? (
                  <Link
                    href={`/accounts/${customerId}/discovery/${inProgress.id}`}
                    className="inline-flex items-center justify-center rounded-md bg-gtn-navy text-white px-3 py-1.5 text-xs"
                  >
                    Continue
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    disabled={creating === kind}
                    onClick={() => startDiscovery(kind)}
                  >
                    {completed ? "Run again" : "Start"}
                  </Button>
                )}
                {completed && (
                  <Link
                    href={`/accounts/${customerId}/discovery/${completed.id}`}
                    className="text-gtn-purple underline text-xs self-center"
                  >
                    view last result
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 bg-gtn-lavender text-xs uppercase tracking-wide font-semibold text-gtn-navy">
          History
        </div>
        {assessments.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gtn-grey-2 text-center">No discovery assessments yet.</p>
        ) : (
          <ul className="divide-y divide-gtn-lavender-2">
            {assessments.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm flex items-center justify-between gap-3">
                <Link className="text-gtn-navy hover:underline" href={`/accounts/${customerId}/discovery/${a.id}`}>
                  {KIND_LABEL[a.kind]}
                </Link>
                <span className="text-xs text-gtn-grey-3">
                  {a.status} ·{" "}
                  {a.completedAt
                    ? `completed ${format(new Date(a.completedAt), "PP")}`
                    : a.startedAt
                    ? `started ${format(new Date(a.startedAt), "PP")}`
                    : "not started"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
