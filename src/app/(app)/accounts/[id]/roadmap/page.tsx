import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canSeeCustomer } from "@/lib/rbac";
import { GatewayLogo } from "@/components/brand/GatewayLogo";
import type { AiReadinessScorecard, NistCsfScorecard, SiteSurveyScorecard } from "@/lib/discovery/scoring";

export const dynamic = "force-dynamic";

export default async function RoadmapPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      lead: true,
      discoveryAssessments: { where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" } },
      onboardingTasks: {
        where: { status: { notIn: ["DONE", "SKIPPED"] } },
        orderBy: [{ phase: "asc" }, { position: "asc" }],
      },
      qbrs: { orderBy: { scheduledAt: "desc" }, take: 3 },
    },
  });
  if (!customer) notFound();
  if (!canSeeCustomer(session.user.role, session.user.id, customer.lead.ownerUserId)) {
    return <p className="text-sm text-gtn-grey-2">Not authorized.</p>;
  }

  const aiCard = customer.discoveryAssessments.find((d) => d.kind === "AI_READINESS")?.scorecard as AiReadinessScorecard | undefined;
  const nistCard = customer.discoveryAssessments.find((d) => d.kind === "NIST_CSF")?.scorecard as NistCsfScorecard | undefined;
  const siteCard = customer.discoveryAssessments.find((d) => d.kind === "SITE_SURVEY")?.scorecard as SiteSurveyScorecard | undefined;

  // Build 0-30 / 31-90 / 91-365 buckets from all sources.
  const buckets: Record<"30" | "90" | "365", string[]> = { "30": [], "90": [], "365": [] };

  if (aiCard) {
    buckets["30"].push(...aiCard.rollout.days_0_30.map((s) => `AI · ${s}`));
    buckets["90"].push(...aiCard.rollout.days_31_90.map((s) => `AI · ${s}`));
    buckets["365"].push(...aiCard.rollout.days_91_365.map((s) => `AI · ${s}`));
  }
  if (nistCard) {
    for (const r of nistCard.remediationRoadmap) {
      buckets[r.phase === "0-30" ? "30" : r.phase === "31-90" ? "90" : "365"].push(`NIST · ${r.item}`);
    }
  }
  if (siteCard) {
    buckets["30"].push(...siteCard.recommendedActions.map((s) => `Survey · ${s}`));
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Screen-only nav back */}
      <div className="container py-4 print:hidden">
        <Link className="text-sm text-gtn-purple underline" href={`/accounts/${id}`}>← back to {customer.lead.businessName}</Link>
        <button
          onClick={() => globalThis.window?.print()}
          className="ml-4 text-sm text-gtn-purple underline"
        >
          Print this page
        </button>
      </div>

      {/* Print-friendly content */}
      <div className="container max-w-4xl mx-auto pb-12 print:pb-0">
        <header className="border-b border-gtn-lavender-2 pb-4 mb-6 print:pb-2 print:mb-4">
          <div className="bg-gtn-navy text-white p-4 rounded-lg flex items-center justify-between print:rounded-none">
            <GatewayLogo variant="onDark" size="md" />
            <div className="text-right text-sm">
              <p className="font-semibold">Strategic Roadmap</p>
              <p className="text-white/70 text-xs">{format(new Date(), "PPP")}</p>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gtn-navy mt-6">{customer.lead.businessName}</h1>
          <p className="text-sm text-gtn-grey-2 mt-1">
            {customer.lead.industry.replace(/_/g, " ")} · {customer.lead.seatCount ?? "—"} seats · {customer.currentPhase.replace(/_/g, " ")}
          </p>
        </header>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-gtn-navy mb-3">Where you are today</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <Stat label="AI maturity" value={aiCard ? `${aiCard.overall.toFixed(1)} / 4` : "—"} />
            <Stat label="NIST CSF current" value={nistCard ? `Tier ${nistCard.overallCurrentTier.toFixed(1)}` : "—"} />
            <Stat label="Risks flagged" value={String((siteCard?.risks.length ?? 0) + (nistCard?.gaps.length ?? 0))} />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-gtn-navy mb-3">Roadmap</h2>
          <Phase title="0–30 days" items={buckets["30"]} />
          <Phase title="31–90 days" items={buckets["90"]} />
          <Phase title="91–365 days" items={buckets["365"]} />
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-gtn-navy mb-3">Outstanding onboarding</h2>
          {customer.onboardingTasks.length === 0 ? (
            <p className="text-sm text-gtn-grey-2">All onboarding tasks complete.</p>
          ) : (
            <ul className="text-sm space-y-1 list-disc pl-5">
              {customer.onboardingTasks.map((t) => (
                <li key={t.id}>
                  <span className="text-gtn-grey-2 text-xs uppercase mr-2">{t.phase.replace(/_/g, " ")}</span>
                  {t.title}
                </li>
              ))}
            </ul>
          )}
        </section>

        {customer.qbrs.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gtn-navy mb-3">Recent QBRs</h2>
            <ul className="text-sm space-y-2">
              {customer.qbrs.map((q) => (
                <li key={q.id}>
                  {format(new Date(q.scheduledAt), "PPP")}
                  {q.completedAt ? <span className="text-gtn-green ml-2">✓ completed</span> : <span className="text-gtn-amber ml-2">upcoming</span>}
                  {q.outcomes && <p className="text-xs text-gtn-grey-2 mt-1 whitespace-pre-wrap">{q.outcomes}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="border-t border-gtn-lavender-2 pt-4 text-xs text-gtn-grey-2 text-center">
          Gateway TelNet · Sales made simple. Operations made sure.
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gtn-lavender-2 p-3 text-center">
      <p className="text-[10px] uppercase tracking-wide text-gtn-grey-2">{label}</p>
      <p className="text-xl font-mono font-bold text-gtn-navy mt-1">{value}</p>
    </div>
  );
}

function Phase({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gtn-purple mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-gtn-grey-2 italic pl-4">No items.</p>
      ) : (
        <ul className="text-sm space-y-1 list-disc pl-5">
          {items.map((i, idx) => <li key={idx}>{i}</li>)}
        </ul>
      )}
    </div>
  );
}
