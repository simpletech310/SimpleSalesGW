import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { ListPage } from "@/components/templates";
import { SowTemplatesEditor } from "./SowTemplatesEditor";

export default async function SowTemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "sow:template:edit")) redirect("/");

  const templates = await prisma.sowTemplate.findMany({
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
  });

  return (
    <ListPage
      title="SOW templates"
      subtitle="Library of Statement-of-Work skeletons. Salespeople pick one when drafting a proposal — Gateway AI fills the {{merge_fields}} from the lead's discovery + approved pricing + your MSP brand voice."
      crumbs={[{ href: "/admin", label: "Admin" }, { label: "SOW templates" }]}
    >
      <SowTemplatesEditor initial={templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        bundle: t.bundle,
        industry: t.industry,
        version: t.version,
        active: t.active,
        scopeMarkdown: t.scopeMarkdown,
        deliverablesMarkdown: t.deliverablesMarkdown,
        timelineMarkdown: t.timelineMarkdown,
        exclusionsMarkdown: t.exclusionsMarkdown,
        termsMarkdown: t.termsMarkdown,
        updatedAt: t.updatedAt.toISOString(),
      }))} />
    </ListPage>
  );
}
