import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { Badge } from "@/components/ui/Badge";
import { loadCatalog } from "@/lib/pricing/loader";
import { DEFAULT_CATALOG } from "@/lib/pricing/catalog";
import { ListPage } from "@/components/templates";
import { PricingEditor } from "./PricingEditor";

export default async function AdminPricingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "pricing:catalog:edit")) redirect("/");

  const catalog = await loadCatalog();
  const isOverride = catalog.version !== DEFAULT_CATALOG.version;

  return (
    <ListPage
      title="Pricing catalog"
      subtitle="Drives sticker math + below-floor enforcement on every pricing approval request."
      crumbs={[{ href: "/admin", label: "Admin" }, { label: "Pricing catalog" }]}
      meta={
        <>
          <Badge tone={isOverride ? "brand" : "neutral"} shape="pill" size="sm" dot>
            v{catalog.version} {isOverride ? "override" : "default"}
          </Badge>
          <span className="text-xs text-ink-muted">
            {Object.keys(catalog.bundles).length} bundles · {Object.keys(catalog.standalone).length} standalone lines
          </span>
        </>
      }
    >
      <PricingEditor initialCatalog={catalog} defaultCatalog={DEFAULT_CATALOG} />
    </ListPage>
  );
}
