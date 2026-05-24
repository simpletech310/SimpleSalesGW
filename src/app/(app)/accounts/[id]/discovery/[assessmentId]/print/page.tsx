import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canSeeCustomer } from "@/lib/rbac";
import { bankForKind, discoveryTitle } from "@/lib/discovery/banks";
import { PrintableForm } from "@/components/print/PrintableForm";
import type { DiscoveryQuestion } from "@/lib/discovery/types";

export const dynamic = "force-dynamic";

export default async function DiscoveryPrintPage({ params }: { params: Promise<{ id: string; assessmentId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id, assessmentId } = await params;

  const assessment = await prisma.discoveryAssessment.findUnique({
    where: { id: assessmentId },
    include: { customer: { include: { lead: { select: { businessName: true, ownerUserId: true } } } } },
  });
  // v2.17 — customer is nullable; explicit guard narrows for the rest.
  if (!assessment || !assessment.customer || assessment.customerId !== id) notFound();
  if (!canSeeCustomer(session.user.role, session.user.id, assessment.customer.lead.ownerUserId)) {
    return <p className="text-sm text-gtn-grey-2">Not authorized.</p>;
  }

  const bank = bankForKind(assessment.kind);
  const title = discoveryTitle(assessment.kind);
  const answers = (assessment.answers as Record<string, unknown>) ?? {};

  // Group by section
  const bySection = new Map<string, DiscoveryQuestion[]>();
  for (const q of bank.questions) {
    if (!bySection.has(q.section)) bySection.set(q.section, []);
    bySection.get(q.section)!.push(q);
  }

  return (
    <PrintableForm title={title} subtitle={assessment.customer.lead.businessName}>
      <div className="space-y-6">
        {Array.from(bySection.entries()).map(([sectionName, qs]) => (
          <section key={sectionName} className="break-inside-avoid">
            <h2 className="text-base font-semibold text-gtn-navy border-b border-gtn-lavender-2 pb-1 mb-2">{sectionName}</h2>
            <ul className="space-y-2 text-sm">
              {qs.map((q) => (
                <li key={q.id} className="flex gap-3 break-inside-avoid">
                  <span className="font-mono text-xs text-gtn-grey-3 w-16 shrink-0">{q.id}</span>
                  <div className="flex-1">
                    <p className="text-gtn-navy">
                      {q.prompt}
                      {q.required && <span className="text-gtn-red ml-1">*</span>}
                    </p>
                    {q.helpText && <p className="text-xs text-gtn-grey-3">{q.helpText}</p>}
                    <PrintAnswer question={q} value={answers[q.id]} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PrintableForm>
  );
}

function PrintAnswer({ question, value }: { question: DiscoveryQuestion; value: unknown }) {
  // Show the current answer if present, otherwise leave a fillable box for paper.
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
    if (question.type === "single_select" || question.type === "multi_select") {
      return (
        <div className="ml-4 mt-1 text-xs text-gtn-grey-2 space-y-0.5">
          {question.options?.map((o) => (
            <div key={o.value}>☐ {o.label}</div>
          ))}
        </div>
      );
    }
    if (question.type === "boolean") {
      return <p className="ml-4 mt-1 text-xs text-gtn-grey-2">☐ Yes ☐ No</p>;
    }
    if (question.type === "numeric" || question.type === "date") {
      return <div className="mt-1 h-6 border-b border-gtn-grey-3 w-40" />;
    }
    if (question.type === "text") {
      return <div className="mt-1 h-12 border border-gtn-grey-3 rounded" />;
    }
    return null;
  }
  // Render the stored value
  if (Array.isArray(value)) {
    return <p className="mt-1 text-xs text-gtn-navy"><strong>→</strong> {value.join(", ")}</p>;
  }
  if (typeof value === "object" && value !== null) {
    return <p className="mt-1 text-xs text-gtn-navy"><strong>→</strong> {JSON.stringify(value)}</p>;
  }
  return <p className="mt-1 text-xs text-gtn-navy"><strong>→</strong> {String(value)}</p>;
}
