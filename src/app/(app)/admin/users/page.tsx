import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { ListPage } from "@/components/templates";
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
    <ListPage
      title="Users"
      subtitle="Create, edit, and deactivate accounts."
      crumbs={[{ href: "/admin", label: "Admin" }, { label: "Users" }]}
    >
      <UserManager
        initialUsers={users.map((u) => ({
          ...u,
          lastLoginAt: u.lastLoginAt ? format(new Date(u.lastLoginAt), "PPp") : null,
          createdAt: format(new Date(u.createdAt), "PPp"),
        }))}
      />
    </ListPage>
  );
}
