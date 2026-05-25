import Link from "next/link";
import { redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { Mail, Phone, Shield, Clock, CalendarDays, Users } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardPage, DashboardSection } from "@/components/templates";
import { Badge } from "@/components/ui/Badge";
import { roleDisplay } from "@/lib/nav/role-nav";
import { MeProfileForm } from "./MeProfileForm";

/**
 * v3.0.5 — /me redesign.
 *
 * Was: title + email + role pill + open next-actions list.
 *
 * Now: identity card (avatar/initials, name, email, role), inline-
 * editable profile form (name, phone), an at-a-glance "stats" row
 * (member since, last login, role tagline, open next-actions count),
 * and the existing open next-actions list as a section.
 */
export default async function MePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email ?? "" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!user) redirect("/login");

  const myOpenActions = await prisma.activity.findMany({
    where: { actorUserId: user.id, nextActionCompleted: false, nextActionDueAt: { not: null } },
    orderBy: { nextActionDueAt: "asc" },
    include: { lead: { select: { id: true, businessName: true } } },
    take: 20,
  });

  const ownedLeadCount = await prisma.lead.count({ where: { ownerUserId: user.id } });

  const roleMeta = roleDisplay(user.role);

  return (
    <DashboardPage
      eyebrow="Your profile"
      title="My account"
      subtitle="Edit your details and see what's on your plate."
    >
      {/* Identity card — avatar + name + role badge */}
      <section className="rounded-2xl bg-surface border border-line-subtle overflow-hidden">
        <div className="bg-gradient-to-br from-brand-soft/40 to-transparent px-5 md:px-6 pt-5 md:pt-6 pb-4 border-b border-line-subtle">
          <div className="flex items-center gap-4">
            <div
              aria-hidden
              className="h-16 w-16 rounded-full bg-brand text-white flex items-center justify-center text-xl font-bold flex-shrink-0 shadow-[0_4px_14px_rgba(91,79,207,0.35)]"
            >
              {initials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-ink-strong leading-tight truncate">{user.name}</h2>
              <p className="text-sm text-ink-muted truncate">{user.email}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Badge tone="brand" shape="pill" size="sm" dot>{roleMeta.label}</Badge>
                <span className="text-xs text-ink-muted italic">{roleMeta.tagline}</span>
              </div>
            </div>
          </div>
        </div>

        {/* At-a-glance stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-line-subtle border-b border-line-subtle">
          <StatPill
            icon={CalendarDays}
            label="Member since"
            value={format(new Date(user.createdAt), "MMM d, yyyy")}
          />
          <StatPill
            icon={Clock}
            label="Last sign-in"
            value={user.lastLoginAt ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true }) : "—"}
          />
          <StatPill
            icon={Users}
            label="Leads owned"
            value={String(ownedLeadCount)}
          />
          <StatPill
            icon={Shield}
            label="Open actions"
            value={String(myOpenActions.length)}
            highlight={myOpenActions.length > 0}
          />
        </div>

        {/* Editable form */}
        <div className="px-5 md:px-6 py-5">
          <MeProfileForm
            initial={{
              name: user.name,
              phone: user.phone,
              email: user.email,
              role: roleMeta.label,
            }}
          />
        </div>
      </section>

      {/* Open next-actions */}
      <DashboardSection
        title="Your open next-actions"
        subtitle="Activities you've scheduled across your leads, oldest first."
        flush
      >
        {myOpenActions.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted text-center">
            Nothing due. Inbox zero. 🎉
          </p>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {myOpenActions.map((a) => {
              const dueAt = a.nextActionDueAt ? new Date(a.nextActionDueAt) : null;
              const isOverdue = dueAt ? dueAt.getTime() < Date.now() : false;
              return (
                <li key={a.id}>
                  <Link
                    href={`/leads/${a.lead.id}`}
                    className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-surface-3/50 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink-strong group-hover:text-gtn-purple transition-colors truncate">
                        {a.lead.businessName}
                      </p>
                      <p className="text-sm text-ink-muted mt-0.5 line-clamp-2">{a.nextAction}</p>
                    </div>
                    <span
                      className={`text-xs flex-shrink-0 tabular whitespace-nowrap font-medium ${
                        isOverdue ? "text-danger" : "text-ink-muted"
                      }`}
                    >
                      {dueAt
                        ? `${isOverdue ? "overdue · " : ""}${format(dueAt, "MMM d, p")}`
                        : "—"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardSection>
    </DashboardPage>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="px-4 md:px-5 py-3 flex items-center gap-3">
      <span
        aria-hidden
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${
          highlight ? "bg-warn-soft text-gtn-amber" : "bg-surface-3 text-ink-muted"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="ui-label">{label}</p>
        <p className="text-sm font-semibold text-ink-strong truncate">{value}</p>
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}
