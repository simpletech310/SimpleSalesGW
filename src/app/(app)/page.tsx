import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { SalespersonHome } from "./_home/SalespersonHome";
import { VcioHome } from "./_home/VcioHome";
import { CooHome } from "./_home/CooHome";

/**
 * v2.13 — role-branching home.
 *
 * The same `/` route renders a different landing per role:
 *   SALESPERSON / SALES_MANAGER / SUPERADMIN → pipeline-first dashboard
 *   VCIO                                     → customer portfolio + QBR/discovery rail
 *   COO                                      → handoff queue + approvals + customer book
 *
 * URL stays `/` so bookmarks survive a role change (e.g. Marcelo flipping
 * between Sales Manager and COO accounts).
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
    case Role.SALESPERSON:
    case Role.SALES_MANAGER:
    case Role.SUPERADMIN:
    default:
      return <SalespersonHome user={user} />;
  }
}
