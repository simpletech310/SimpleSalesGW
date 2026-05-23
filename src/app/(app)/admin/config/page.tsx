import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { Card } from "@/components/ui/Card";
import { ConfigForm } from "./ConfigForm";
import { SCORING_DEFAULTS } from "@/lib/scoring/engine";

export default async function ConfigPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "system:config")) redirect("/");

  const thresholdRow = await prisma.systemConfig.findUnique({ where: { key: "scoring.thresholds" } });
  const thresholds = (thresholdRow?.value as { servicesBelow?: number; dealQualityBelow?: number }) ?? SCORING_DEFAULTS.nonStrategic;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-gtn-navy">System config</h1>
      <Card>
        <ConfigForm
          servicesBelow={thresholds.servicesBelow ?? SCORING_DEFAULTS.nonStrategic.servicesBelow}
          dealQualityBelow={thresholds.dealQualityBelow ?? SCORING_DEFAULTS.nonStrategic.dealQualityBelow}
        />
      </Card>
      <Card>
        <h2 className="text-sm font-semibold mb-2">Default weights (read-only — change scoring engine to edit)</h2>
        <pre className="text-xs bg-gtn-lavender p-3 rounded overflow-x-auto">{JSON.stringify(SCORING_DEFAULTS, null, 2)}</pre>
      </Card>
    </div>
  );
}
