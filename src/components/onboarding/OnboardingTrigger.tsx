"use client";

import { useEffect, useState } from "react";
import { Role } from "@prisma/client";
import { OnboardingModal } from "./OnboardingModal";
import { flowFor } from "@/lib/onboarding/role-flows";

/**
 * OnboardingTrigger — embedded in AppShell. Fetches the user's preferences on
 * mount. If the role's onboarding flow hasn't been dismissed, shows the modal.
 *
 * Once dismissed, the in-memory state hides it immediately (no flicker on the
 * next navigation since the server has already recorded the dismissal).
 */
export function OnboardingTrigger({ role }: { role: Role }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/onboarding");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const seen: string[] = data.preferences?.onboardingSeen ?? [];
        const flow = flowFor(role);
        if (!seen.includes(flow.flowKey)) setShow(true);
      } catch {
        /* fail-quiet — onboarding is a nice-to-have, not a blocker */
      }
    })();
    return () => { cancelled = true; };
  }, [role]);

  if (!show) return null;
  const flow = flowFor(role);
  return <OnboardingModal flow={flow} onDismiss={() => setShow(false)} />;
}
