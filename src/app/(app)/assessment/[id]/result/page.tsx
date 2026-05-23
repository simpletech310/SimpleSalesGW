import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { STRINGS } from "@/lib/strings";
import { scoreBadgeClass, formatScore } from "@/lib/utils";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      lead: {
        include: {
          serviceMatches: { orderBy: [{ recommended: "desc" }, { fitScore: "desc" }] },
        },
      },
    },
  });
  if (!assessment) notFound();
  const lead = assessment.lead;

  const bucket =
    lead.dealQualityScore >= 85 ? "lighthouse" :
    lead.dealQualityScore >= 70 ? "strong_fit" :
    lead.dealQualityScore >= 50 ? "marginal" :
    lead.dealQualityScore >= 30 ? "refer_or_wait" : "polite_decline";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href={`/leads/${lead.id}`} className="text-sm text-gtn-purple underline">← {lead.businessName}</Link>
        <h1 className="text-2xl font-bold text-gtn-navy mt-2">Assessment result</h1>
        <p className="text-sm text-gtn-grey-2">{STRINGS.scoring.buckets[bucket]}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-gtn-grey-2">{STRINGS.scoring.services}</p>
          <p className="mt-1"><span className={scoreBadgeClass(lead.servicesScore)}>{formatScore(lead.servicesScore)}</span></p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-gtn-grey-2">{STRINGS.scoring.customer}</p>
          <p className="mt-1"><span className={scoreBadgeClass(lead.customerScore)}>{formatScore(lead.customerScore)}</span></p>
        </Card>
        <div className="gtn-card p-5 bg-gtn-navy text-white">
          <p className="text-xs uppercase tracking-wide text-white/70">{STRINGS.scoring.dealQuality}</p>
          <p className="mt-1 text-3xl font-mono font-bold">{formatScore(lead.dealQualityScore)}</p>
        </div>
      </div>

      {lead.nonStrategicFlag && (
        <div className="gtn-callout gtn-callout--warning">
          {STRINGS.assessment.nonStrategicBanner}
        </div>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Recommended services</h2>
        <ul className="space-y-3">
          {lead.serviceMatches.filter((m) => m.recommended).map((m) => (
            <li key={m.id} className="flex items-start justify-between border-t border-gtn-lavender-2 pt-3 first:border-0 first:pt-0">
              <div>
                <p className="text-sm font-medium text-gtn-navy">{m.serviceLine.replace(/_/g, " ")}</p>
                <p className="text-xs text-gtn-grey-2">{m.reasoning}</p>
              </div>
              <span className="font-mono text-sm">+{m.fitScore}</span>
            </li>
          ))}
          {lead.serviceMatches.filter((m) => m.recommended).length === 0 && (
            <li className="text-sm text-gtn-grey-2">No service lines triggered.</li>
          )}
        </ul>
        {lead.suggestedBundle && (
          <div className="mt-4 gtn-callout gtn-callout--info">
            Suggested bundle: <strong>{lead.suggestedBundle.replace(/_/g, " ")}</strong>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Suggested next actions</h2>
        <ul className="text-sm space-y-2 list-disc pl-5">
          <li>Confirm executive sponsor and approver(s) named on the deal.</li>
          <li>Schedule a deep-dive on the highest-weight triggered service.</li>
          {lead.nonStrategicFlag && <li>Request Sales Manager approval before advancing past Proposal.</li>}
          {lead.dealQualityScore >= 70 && <li>Move to Discovery this week; draft a tailored outreach.</li>}
          <li>Send the Gateway service overview deck.</li>
        </ul>
      </Card>

      <div className="flex justify-end gap-2">
        <Button asChild variant="secondary">
          <Link href={`/leads/${lead.id}`}>Back to lead</Link>
        </Button>
        <Button asChild>
          <Link href={`/leads/${lead.id}/outreach`}>Send outreach</Link>
        </Button>
      </div>
    </div>
  );
}
