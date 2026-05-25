import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { FormPage, FormSection } from "@/components/templates";
import { ConfigForm } from "./ConfigForm";
import { SCORING_DEFAULTS } from "@/lib/scoring/engine";

export default async function ConfigPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "system:config")) redirect("/");

  const thresholdRow = await prisma.systemConfig.findUnique({ where: { key: "scoring.thresholds" } });
  const thresholds =
    (thresholdRow?.value as { servicesBelow?: number; dealQualityBelow?: number }) ??
    SCORING_DEFAULTS.nonStrategic;

  return (
    <FormPage
      title="System config"
      subtitle="Tune the scoring thresholds the lead-quality engine uses to flag non-strategic deals."
      crumbs={[{ href: "/admin", label: "Admin" }, { label: "System config" }]}
      width="md"
    >
      <FormSection title="Non-strategic thresholds" subtitle="Leads below these values are flagged with the non-strategic badge.">
        <ConfigForm
          servicesBelow={thresholds.servicesBelow ?? SCORING_DEFAULTS.nonStrategic.servicesBelow}
          dealQualityBelow={thresholds.dealQualityBelow ?? SCORING_DEFAULTS.nonStrategic.dealQualityBelow}
        />
      </FormSection>
      <FormSection title="Default weights" subtitle="Read-only — change the scoring engine source to edit.">
        <pre className="text-xs bg-surface-2 border border-line-subtle p-3 rounded-md overflow-x-auto leading-relaxed">
          {JSON.stringify(SCORING_DEFAULTS, null, 2)}
        </pre>
      </FormSection>
    </FormPage>
  );
}
