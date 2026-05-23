"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HeroBand, IconTile, NumberedStep, Pill } from "@/components/brand";
import type { OnboardingFlow } from "@/lib/onboarding/role-flows";

/**
 * First-run onboarding modal — renders the role's flow as a single scrollable
 * column on top of a dimmed backdrop. Dismissing it POSTs the flow's key to
 * /api/me/onboarding so the modal never re-shows for this user.
 */
export function OnboardingModal({
  flow,
  onDismiss,
}: {
  flow: OnboardingFlow;
  /** Called with the flowKey after the server confirms dismissal. */
  onDismiss: (flowKey: string) => void;
}) {
  const [dismissing, setDismissing] = useState(false);

  async function dismiss() {
    setDismissing(true);
    try {
      await fetch("/api/me/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowKey: flow.flowKey }),
      });
      onDismiss(flow.flowKey);
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center sm:justify-center bg-gtn-navy/70 backdrop-blur-sm overflow-y-auto p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="bg-white w-full max-w-3xl rounded-none sm:rounded-xl shadow-card max-h-full overflow-y-auto">
        {/* Hero band */}
        <HeroBand
          eyebrow={flow.eyebrow}
          title={<span id="onboarding-title">{flow.title}</span>}
          subtitle={flow.subtitle}
        >
          <div className="grid grid-cols-4 gap-3 max-w-md">
            {flow.steps.slice(0, 4).map((s) => (
              <IconTile key={s.stepKey} Icon={s.Icon} size="lg" />
            ))}
          </div>
        </HeroBand>

        {/* Steps */}
        <div className="p-6 sm:p-8 space-y-6">
          <Pill dot tone="purple">First-time walkthrough</Pill>
          <div className="space-y-6">
            {flow.steps.map((step, i) => (
              <div key={step.stepKey}>
                <NumberedStep n={i + 1} title={step.title}>
                  <p className="mb-2">{step.body}</p>
                  {step.action && (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={step.action.href} onClick={dismiss}>
                        {step.action.label} →
                      </Link>
                    </Button>
                  )}
                </NumberedStep>
              </div>
            ))}
          </div>

          <p className="text-xs text-gtn-grey-2 border-t border-gtn-lavender-2 pt-4">
            You can re-open this walkthrough any time from the <strong>?</strong> button in the bottom-right or via <Link href="/help" className="text-gtn-purple underline">Help</Link>.
          </p>
        </div>

        {/* Footer actions */}
        <div className="px-6 sm:px-8 py-4 border-t border-gtn-lavender-2 flex items-center justify-between gap-2 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={dismiss}
            disabled={dismissing}
            className="text-xs text-gtn-grey-2 hover:text-gtn-navy inline-flex items-center gap-1"
          >
            <X size={12} /> Skip for now
          </button>
          <Button onClick={dismiss} disabled={dismissing}>
            {dismissing ? "Saving…" : "Got it, take me in"}
          </Button>
        </div>
      </div>
    </div>
  );
}
