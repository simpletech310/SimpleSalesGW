import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/prisma";
import { logIntegrationHealthBanner } from "@/lib/env";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // v2.14 — one-time-per-process integration banner. Self-dedupes.
  logIntegrationHealthBanner();

  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) redirect("/login");

  return (
    <AppShell user={user}>
      {children}
    </AppShell>
  );
}
