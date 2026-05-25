import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ListPage } from "@/components/templates";
import { ObjectionsEditor } from "./ObjectionsEditor";

export default async function AdminObjectionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPERADMIN") redirect("/");

  const templates = await prisma.objectionTemplate.findMany({
    orderBy: [{ active: "desc" }, { category: "asc" }, { trigger: "asc" }],
  });

  return (
    <ListPage
      title="Objections library"
      subtitle="Reference catalog of named objections + tested rebuttals. Lin sees the industry-matched + global entries inside each lead's Objections tab."
      crumbs={[{ href: "/admin", label: "Admin" }, { label: "Objections" }]}
    >
      <ObjectionsEditor initial={templates as never} />
    </ListPage>
  );
}
