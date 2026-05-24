import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { Card } from "@/components/ui/Card";

export default async function AdminHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  // v2.14 — widen the admit-gate to include pricing:catalog:edit so
  // Sales Manager can land here for the pricing editor.
  if (
    !can(role, "user:manage") &&
    !can(role, "audit:view") &&
    !can(role, "system:config") &&
    !can(role, "pricing:catalog:edit")
  ) {
    redirect("/");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gtn-navy">Admin</h1>

      {/* v2.14 — First-run setup tile, top of grid, two-column wide */}
      {(can(role, "pricing:catalog:edit") || can(role, "user:manage")) && (
        <Link href="/admin/setup" className="block">
          <Card className="bg-gtn-lavender border-gtn-purple/40 hover:border-gtn-purple">
            <h2 className="text-lg font-semibold text-gtn-purple">⚡ First-run setup</h2>
            <p className="text-sm text-gtn-grey-2 mt-1">
              Walk through the 6 steps to make this portal usable for your team day to day —
              env health, real users, pricing catalog, prospect import, library customization,
              and email test.
            </p>
          </Card>
        </Link>
      )}

      <div className="grid md:grid-cols-3 gap-3">
        {can(role, "user:manage") && (
          <Link href="/admin/users" className="block">
            <Card><h2 className="text-lg font-semibold">Users</h2><p className="text-sm text-gtn-grey-2 mt-1">Create, edit, deactivate accounts.</p></Card>
          </Link>
        )}
        {can(role, "audit:view") && (
          <Link href="/admin/audit" className="block">
            <Card><h2 className="text-lg font-semibold">Audit log</h2><p className="text-sm text-gtn-grey-2 mt-1">Every state change is recorded here.</p></Card>
          </Link>
        )}
        {can(role, "system:config") && (
          <Link href="/admin/config" className="block">
            <Card><h2 className="text-lg font-semibold">System config</h2><p className="text-sm text-gtn-grey-2 mt-1">Tune scoring thresholds + weights.</p></Card>
          </Link>
        )}
        {can(role, "pricing:catalog:edit") && (
          <Link href="/admin/pricing" className="block">
            <Card><h2 className="text-lg font-semibold">Pricing catalog</h2><p className="text-sm text-gtn-grey-2 mt-1">Edit bundle prices, floors, and onboarding fees.</p></Card>
          </Link>
        )}
        {can(role, "system:config") && (
          <Link href="/admin/outreach" className="block">
            <Card><h2 className="text-lg font-semibold">Outreach templates</h2><p className="text-sm text-gtn-grey-2 mt-1">Manage the cold-outreach + follow-up library.</p></Card>
          </Link>
        )}
        {can(role, "system:config") && (
          <Link href="/admin/objections" className="block">
            <Card><h2 className="text-lg font-semibold">Objections library</h2><p className="text-sm text-gtn-grey-2 mt-1">Catalog of objections + tested rebuttals.</p></Card>
          </Link>
        )}
        {can(role, "audit:view") && (
          <Link href="/admin/ai-usage" className="block">
            <Card><h2 className="text-lg font-semibold">AI usage</h2><p className="text-sm text-gtn-grey-2 mt-1">Month-to-date Claude spend by feature, lead, and user.</p></Card>
          </Link>
        )}
      </div>
    </div>
  );
}
