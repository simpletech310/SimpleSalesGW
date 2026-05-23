import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Callout } from "@/components/brand";

/**
 * NextStepHint — a TIP-style callout that points the user at what to do next.
 *
 * Use after a key action saves to keep the user moving rather than stranding
 * them on a "saved successfully" screen.
 *
 *   <NextStepHint
 *     label="What's next"
 *     action={{ label: "Send for COO acceptance", href: "/leads/123/handoff" }}
 *   >
 *     The Sales Manager approved your discount. Time to draft the handoff.
 *   </NextStepHint>
 */
export function NextStepHint({
  label = "What's next",
  action,
  children,
}: {
  label?: string;
  action?: { label: string; href: string };
  children: ReactNode;
}) {
  return (
    <Callout kind="tip" label={label}>
      <p className="mb-2">{children}</p>
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-1 text-sm font-medium text-gtn-purple hover:text-gtn-purple-2"
        >
          {action.label} <ArrowRight size={14} />
        </Link>
      )}
    </Callout>
  );
}
