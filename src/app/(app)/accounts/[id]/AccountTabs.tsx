"use client";

import { useState } from "react";
import { OnboardingPhase } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import { OnboardingPanel } from "./OnboardingPanel";
import { DiscoveryPanel } from "./DiscoveryPanel";
import { QbrsPanel } from "./QbrsPanel";
import { InventoryPanel } from "./InventoryPanel";
import { DocumentsPanel } from "./DocumentsPanel";

const TABS = ["Onboarding", "Discovery", "Inventory", "QBRs", "Documents", "Roadmap"] as const;

type Props = {
  customerId: string;
  currentPhase: OnboardingPhase;
  leadOwnerEmail: string;
  discoveryAssessments: Array<{
    id: string;
    kind:
      | "SITE_SURVEY"
      | "AI_READINESS"
      | "NIST_CSF"
      | "NIST_800_171"
      | "VOICE_SCOPING"
      | "CCTV_SCOPING"
      | "ACCESS_CONTROL_SCOPING";
    status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
    startedAt: string | null;
    completedAt: string | null;
    createdByName: string;
  }>;
  qbrs: Array<{
    id: string;
    scheduledAt: string;
    completedAt: string | null;
  }>;
};

/**
 * v3.1.4 — tab strip rewritten with v3 tokens. Active tab uses brand
 * underline + ink-strong text, inactive uses ink-muted. Mobile remains
 * horizontally scrollable.
 */
export function AccountTabs({ customerId, currentPhase, discoveryAssessments, qbrs }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Onboarding");
  return (
    <div>
      <div className="border-b border-line-subtle overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? "px-4 py-3 text-sm font-semibold border-b-2 border-gtn-purple text-ink-strong -mb-px transition-colors"
                  : "px-4 py-3 text-sm text-ink-muted hover:text-ink-strong border-b-2 border-transparent -mb-px transition-colors"
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {tab === "Onboarding" && <OnboardingPanel customerId={customerId} currentPhase={currentPhase} />}
        {tab === "Discovery" && <DiscoveryPanel customerId={customerId} assessments={discoveryAssessments} />}
        {tab === "Inventory" && <InventoryPanel customerId={customerId} />}
        {tab === "QBRs" && <QbrsPanel customerId={customerId} qbrs={qbrs} />}
        {tab === "Documents" && <DocumentsPanel scope="customer" parentId={customerId} />}
        {tab === "Roadmap" && (
          <div className="rounded-xl bg-surface border border-line-subtle p-6">
            <h3 className="text-sm font-semibold text-ink-strong mb-1">Strategic roadmap</h3>
            <p className="text-xs text-ink-muted mb-4">
              Multi-quarter view of NIST gaps, AI initiatives, lifecycle replacements, and major changes
              — synthesized into one rolling plan with budget + sequencing.
            </p>
            <a
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gtn-purple hover:underline"
              href={`/accounts/${customerId}/roadmap`}
              target="_blank"
              rel="noreferrer"
            >
              Open strategic roadmap
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
