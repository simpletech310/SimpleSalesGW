import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  ScrollText,
  Settings,
  DollarSign,
  Mail,
  MessageCircle,
  Sparkles,
  Building2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { DashboardPage } from "@/components/templates";

export default async function AdminHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (
    !can(role, "user:manage") &&
    !can(role, "audit:view") &&
    !can(role, "system:config") &&
    !can(role, "pricing:catalog:edit")
  ) {
    redirect("/");
  }

  return (
    <DashboardPage
      eyebrow="Administration"
      title="Admin"
      subtitle="Manage users, system config, pricing, content, and audit history."
    >
      {(can(role, "pricing:catalog:edit") || can(role, "user:manage")) && (
        <Link
          href="/admin/setup"
          className="block rounded-xl bg-gradient-to-br from-brand-soft to-surface border border-line p-5 hover:border-brand transition-colors group"
        >
          <div className="flex items-start gap-4">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gtn-purple text-white shadow-card">
              <Zap className="h-6 w-6" />
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-ink-strong">First-run setup</h2>
              <p className="text-sm text-ink-muted mt-1 max-w-2xl">
                Walk through the 6 steps to make this portal usable for your team day-to-day — env health, real users, pricing catalog, prospect import, library customization, and email test.
              </p>
            </div>
            <span className="text-gtn-purple text-2xl group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {can(role, "user:manage") && (
          <AdminTile icon={Users} href="/admin/users" title="Users" desc="Create, edit, deactivate accounts." />
        )}
        {can(role, "audit:view") && (
          <AdminTile icon={ScrollText} href="/admin/audit" title="Audit log" desc="Every state change is recorded here." />
        )}
        {can(role, "system:config") && (
          <AdminTile icon={Settings} href="/admin/config" title="System config" desc="Tune scoring thresholds + weights." />
        )}
        {can(role, "pricing:catalog:edit") && (
          <AdminTile icon={DollarSign} href="/admin/pricing" title="Pricing catalog" desc="Edit bundle prices, floors, and onboarding fees." />
        )}
        {can(role, "system:config") && (
          <AdminTile icon={Mail} href="/admin/outreach" title="Outreach templates" desc="Manage the cold-outreach + follow-up library." />
        )}
        {can(role, "system:config") && (
          <AdminTile icon={MessageCircle} href="/admin/objections" title="Objections library" desc="Catalog of objections + tested rebuttals." />
        )}
        {can(role, "audit:view") && (
          <AdminTile icon={Sparkles} href="/admin/ai-usage" title="AI usage" desc="Month-to-date Claude spend by feature, lead, and user." />
        )}
        {can(role, "msp:profile:edit") && (
          <AdminTile icon={Building2} href="/admin/msp-profile" title="MSP profile" desc="Mission, brand voice, services emphasis, win stories — feeds every Claude prompt." />
        )}
      </div>
    </DashboardPage>
  );
}

function AdminTile({
  icon: Icon,
  href,
  title,
  desc,
}: {
  icon: LucideIcon;
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl bg-surface border border-line-subtle p-4 md:p-5 hover:border-line-strong hover:shadow-card transition-all duration-120 ease-smooth"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-soft text-gtn-purple flex-shrink-0">
          <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink-strong">{title}</h2>
          <p className="text-sm text-ink-muted mt-0.5 line-clamp-2">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
