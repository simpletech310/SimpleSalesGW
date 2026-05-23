import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { Card } from "@/components/ui/Card";
import { loadCatalog } from "@/lib/pricing/loader";
import { DEFAULT_CATALOG } from "@/lib/pricing/catalog";
import { PricingEditor } from "./PricingEditor";

export default async function AdminPricingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "system:config")) redirect("/");

  const catalog = await loadCatalog();
  const isOverride = catalog.version !== DEFAULT_CATALOG.version;

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gtn-navy">Pricing catalog</h1>
        <p className="text-sm text-gtn-grey-2">
          Drives sticker math + below-floor enforcement on every pricing approval request.
        </p>
      </div>

      <Card>
        <p className="text-sm">
          Active version: <code className="gtn-code-pill">{catalog.version}</code>{" "}
          {isOverride ? (
            <span className="text-gtn-purple ml-2">override</span>
          ) : (
            <span className="text-gtn-grey-2 ml-2">using committed defaults</span>
          )}
        </p>
        <p className="text-xs text-gtn-grey-2 mt-2">
          Bundles defined: {Object.keys(catalog.bundles).length} · Standalone service lines: {Object.keys(catalog.standalone).length}
        </p>
      </Card>

      <PricingEditor initialCatalog={catalog} defaultCatalog={DEFAULT_CATALOG} />
    </div>
  );
}
