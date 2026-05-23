import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ObjectionsEditor } from "./ObjectionsEditor";

export default async function AdminObjectionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPERADMIN") redirect("/");

  const templates = await prisma.objectionTemplate.findMany({
    orderBy: [{ active: "desc" }, { category: "asc" }, { trigger: "asc" }],
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gtn-navy">Objections library</h1>
        <p className="text-sm text-gtn-grey-2 mt-1">
          {"Reference catalog of named objections + tested rebuttals. Lin sees the industry-matched + global entries inside each lead's Objections tab."}
        </p>
      </div>
      <ObjectionsEditor initial={templates as never} />
    </div>
  );
}
