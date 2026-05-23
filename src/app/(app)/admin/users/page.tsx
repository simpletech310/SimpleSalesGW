import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { Card } from "@/components/ui/Card";
import { UserManager } from "./UserManager";

export default async function UsersAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "user:manage")) redirect("/");

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gtn-navy">Users</h1>
      </div>

      <UserManager initialUsers={users.map((u) => ({
        ...u,
        lastLoginAt: u.lastLoginAt ? format(new Date(u.lastLoginAt), "PPp") : null,
        createdAt: format(new Date(u.createdAt), "PPp"),
      }))} />
    </div>
  );
}
