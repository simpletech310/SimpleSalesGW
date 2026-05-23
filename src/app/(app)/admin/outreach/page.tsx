import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OutreachEditor } from "./OutreachEditor";

export default async function AdminOutreachPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPERADMIN") redirect("/");

  const templates = await prisma.outreachTemplate.findMany({
    orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gtn-navy">Outreach templates</h1>
        <p className="text-sm text-gtn-grey-2 mt-1">
          {"DB-backed library. Vertical + trigger filters apply when Lin opens a Lead's outreach composer."}
        </p>
      </div>
      <OutreachEditor initial={templates as never} />
    </div>
  );
}
