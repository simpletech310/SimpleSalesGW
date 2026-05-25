import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ListPage } from "@/components/templates";
import { OutreachEditor } from "./OutreachEditor";

export default async function AdminOutreachPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPERADMIN") redirect("/");

  const templates = await prisma.outreachTemplate.findMany({
    orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }],
  });

  return (
    <ListPage
      title="Outreach templates"
      subtitle="DB-backed library. Vertical + trigger filters apply when Lin opens a Lead's outreach composer."
      crumbs={[{ href: "/admin", label: "Admin" }, { label: "Outreach" }]}
    >
      <OutreachEditor initial={templates as never} />
    </ListPage>
  );
}
