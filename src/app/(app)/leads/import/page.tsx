import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { DashboardPage } from "@/components/templates";
import { BulkImportClient } from "./BulkImportClient";

/**
 * v3.3.9 — Bulk lead import page.
 *
 * SALESPERSON can import to their own ownership.
 * SALES_MANAGER / SUPERADMIN can additionally assign imports to another rep.
 */
export default async function LeadImportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "lead:create")) {
    return (
      <div className="rounded-xl bg-surface border border-line-subtle p-6 max-w-md">
        <h2 className="text-lg font-semibold text-ink-strong">Not authorized</h2>
        <p className="text-sm text-ink-muted mt-1">You need lead:create to import.</p>
      </div>
    );
  }
  const canAssign = can(session.user.role, "lead:assign") || can(session.user.role, "sales-rep:create");

  return (
    <DashboardPage
      eyebrow="Leads"
      title="Bulk import"
      subtitle="Upload a CSV. We'll preview parsed rows, flag errors, and only create on confirm. Duplicates by business name are skipped."
    >
      <BulkImportClient canAssign={canAssign} />
    </DashboardPage>
  );
}
