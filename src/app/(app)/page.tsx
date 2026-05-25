import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { SalespersonHome } from "./_home/SalespersonHome";
import { SalesManagerHome } from "./_home/SalesManagerHome";
import { VcioHome } from "./_home/VcioHome";
import { CooHome } from "./_home/CooHome";
import { AdminHome } from "./_home/AdminHome";

/**
 * v3.1 — role-branching home, five distinct dashboards.
 *
 * Same `/` URL — the rendered component depends on the signed-in role:
 *   SALESPERSON    → pipeline + top opps + stale + this-week
 *   SALES_MANAGER  → approvals + team pipeline + rep leaderboard
 *   VCIO           → portfolio + at-risk + recent discovery/QBR activity
 *   COO            → handoff queue + recent decisions + weekly throughput
 *   SUPERADMIN     → integration health + audit feed + AI spend
 *
 * Keeping the URL stable means bookmarks survive a role change (e.g. an
 * operator flipping between SUPERADMIN and COO accounts).
 */
export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = {
    id: session.user.id,
    name: session.user.name ?? null,
    role: session.user.role,
  };

  switch (user.role) {
    case Role.VCIO:
      return <VcioHome user={user} />;
    case Role.COO:
      return <CooHome user={user} />;
    case Role.SALES_MANAGER:
      return <SalesManagerHome user={user} />;
    case Role.SUPERADMIN:
      return <AdminHome user={user} />;
    case Role.SALESPERSON:
    default:
      return <SalespersonHome user={user} />;
  }
}
