import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { Card } from "@/components/ui/Card";

export default async function AdminHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (!can(role, "user:manage") && !can(role, "audit:view")) redirect("/");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gtn-navy">Admin</h1>
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
      </div>
    </div>
  );
}
