"use client";

import { useState } from "react";
import { OnboardingPhase } from "@prisma/client";
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
    // v2.17 — widened to the full DiscoveryKind union to accept migrated
    // pre-sale assessments. DiscoveryPanel's render path is kind-agnostic.
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

export function AccountTabs({ customerId, currentPhase, discoveryAssessments, qbrs }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Onboarding");
  return (
    <div>
      <div className="border-b border-gtn-lavender-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? "px-4 py-3 text-sm font-semibold border-b-2 border-gtn-navy text-gtn-navy"
                  : "px-4 py-3 text-sm text-gtn-grey-2 hover:text-gtn-navy"
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
          <div className="gtn-card p-4">
            <a
              className="text-gtn-purple underline"
              href={`/accounts/${customerId}/roadmap`}
              target="_blank"
              rel="noreferrer"
            >
              Open strategic roadmap →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
