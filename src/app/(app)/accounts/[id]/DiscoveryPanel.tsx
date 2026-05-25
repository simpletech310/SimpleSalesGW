"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowRight, ClipboardList, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/help/EmptyState";
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
  VOICE_SCOPING: "Voice Pre-Sale Scoping (from Lead)",
  CCTV_SCOPING: "CCTV Pre-Sale Scoping (from Lead)",
  ACCESS_CONTROL_SCOPING: "Access Control Pre-Sale Scoping (from Lead)",
};

const KIND_BLURB: Record<DiscoveryKind, string> = {
  SITE_SURVEY: "Inventory of sites, identity, endpoints, backups, security stack, and compliance obligations.",
  AI_READINESS: "Org readiness 0-4 scorecard plus a prioritized use-case catalog and 30/60/90 roadmap.",
  NIST_CSF: "All 106 NIST CSF 2.0 Subcategories scored Tier 1-4 with rolled-up Category + Function summary, gap list, and remediation roadmap.",
  NIST_800_171: "110 NIST 800-171 Rev 2 controls × 14 families. Produces SPRS score, POAM register, and SSP draft for CMMC Level 2/3 readiness.",
  VOICE_SCOPING: "Pre-sale voice scoping that ran on the lead — captured extension counts, hardware needs, install context.",
  CCTV_SCOPING: "Pre-sale CCTV scoping that ran on the lead — camera count, retention, NVR sizing.",
  ACCESS_CONTROL_SCOPING: "Pre-sale access-control scoping that ran on the lead — door count, hardware, cardholder roster.",
};

const STATUS_TONE: Record<Assessment["status"], "neutral" | "brand" | "success"> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "brand",
  COMPLETED: "success",
};

/**
 * v3.1.4 — Discovery panel rebuilt on v3 tokens + Badge.
 */
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
      {/* Assessment kind cards */}
      <div className="grid md:grid-cols-2 gap-3">
        {kinds.map((kind) => {
          const inProgress = assessments.find((a) => a.kind === kind && a.status === "IN_PROGRESS");
          const completed = assessments.find((a) => a.kind === kind && a.status === "COMPLETED");
          const isLoading = creating === kind;
          return (
            <div
              key={kind}
              className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5 flex flex-col gap-3 hover:border-line-strong transition-colors"
            >
              <div>
                <p className="ui-label">{kind.replace(/_/g, " ")}</p>
                <h3 className="text-sm font-semibold text-ink-strong mt-1.5">{KIND_LABEL[kind]}</h3>
                <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">{KIND_BLURB[kind]}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
                {inProgress ? (
                  <Button asChild size="sm">
                    <Link href={`/accounts/${customerId}/discovery/${inProgress.id}`}>
                      Continue
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" disabled={isLoading} onClick={() => startDiscovery(kind)}>
                    {isLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    {completed ? "Run again" : "Start"}
                  </Button>
                )}
                {completed && (
                  <Link
                    href={`/accounts/${customerId}/discovery/${completed.id}`}
                    className="text-xs text-gtn-purple hover:underline font-medium"
                  >
                    view last result →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* History */}
      <div className="rounded-xl bg-surface border border-line-subtle overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-2 border-b border-line-subtle">
          <h3 className="ui-label">Assessment history</h3>
        </div>
        {assessments.length === 0 ? (
          <div className="px-4 py-2">
            <EmptyState
              Icon={ClipboardList}
              title="No assessments yet"
              body="Pick one of the four discovery flows above. Most accounts start with the MSP Site Survey to capture a baseline."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {assessments.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm flex items-center justify-between gap-3 hover:bg-surface-3/30 transition-colors">
                <Link
                  className="text-ink-strong hover:text-gtn-purple font-medium min-w-0 truncate"
                  href={`/accounts/${customerId}/discovery/${a.id}`}
                >
                  {KIND_LABEL[a.kind]}
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge tone={STATUS_TONE[a.status]} shape="pill" size="xs">
                    {a.status.toLowerCase().replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs text-ink-faint tabular hidden sm:inline">
                    {a.completedAt
                      ? format(new Date(a.completedAt), "MMM d, yyyy")
                      : a.startedAt
                      ? format(new Date(a.startedAt), "MMM d, yyyy")
                      : "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
