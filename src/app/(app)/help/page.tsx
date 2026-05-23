import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  HeroBand,
  IconTile,
  LetteredSubstep,
  NumberedStep,
  Pill,
} from "@/components/brand";
import { flowFor } from "@/lib/onboarding/role-flows";
import { GLOSSARY_CATEGORIES, glossaryByCategory } from "@/lib/glossary";

/**
 * /help — always-available role-specific walkthrough + glossary.
 *
 * Renders the same content as the first-run OnboardingModal but as a
 * permanent reference. Useful for new hires, role switches, or quick
 * acronym lookups.
 */
export default async function HelpPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const flow = flowFor(session.user.role);
  const byCategory = glossaryByCategory();

  const CATEGORY_TITLES: Record<string, string> = {
    compliance: "Compliance frameworks",
    tooling:    "Tooling",
    sales:      "Sales + contracts",
    ops:        "Ops + cadence",
    general:    "Other",
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <HeroBand
        eyebrow={flow.eyebrow}
        title={flow.title}
        subtitle={flow.subtitle}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/">Back to dashboard</Link>
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-4 gap-3 max-w-md">
          {flow.steps.slice(0, 4).map((s) => (
            <IconTile key={s.stepKey} Icon={s.Icon} size="lg" />
          ))}
        </div>
      </HeroBand>

      {/* Walkthrough */}
      <Card>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <h2 className="gtn-section-label">Your walkthrough</h2>
          <Pill dot tone="purple">{flow.role.replace(/_/g, " ")}</Pill>
        </div>
        <div className="space-y-6">
          {flow.steps.map((step, i) => (
            <NumberedStep key={step.stepKey} n={i + 1} title={step.title}>
              <p className="mb-2">{step.body}</p>
              {step.action && (
                <Button asChild size="sm" variant="secondary">
                  <Link href={step.action.href}>{step.action.label} →</Link>
                </Button>
              )}
            </NumberedStep>
          ))}
        </div>
      </Card>

      {/* Glossary */}
      <Card>
        <h2 className="gtn-section-label mb-4">Glossary</h2>
        <p className="text-sm text-gtn-grey-2 mb-6">
          Plain-English definitions for every acronym you&apos;ll see in the portal. Hover any underlined term in the app and the definition pops up — this page is the full reference.
        </p>
        <div className="space-y-6">
          {GLOSSARY_CATEGORIES.map((cat) => {
            const entries = byCategory[cat] ?? [];
            if (entries.length === 0) return null;
            return (
              <section key={cat}>
                <h3 className="gtn-eyebrow gtn-eyebrow--dark mb-3">{CATEGORY_TITLES[cat]}</h3>
                <div className="space-y-2">
                  {entries.map((e) => (
                    <LetteredSubstep
                      key={e.term}
                      letter={e.term.charAt(0).toUpperCase()}
                      title={e.term}
                    >
                      {e.definition}
                    </LetteredSubstep>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
