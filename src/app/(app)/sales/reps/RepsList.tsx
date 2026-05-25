"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Loader2, Plus, Star, UserPlus, X } from "lucide-react";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/help/EmptyState";
import { cn } from "@/lib/utils";

type RepRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  lastLoginAt: string | null;
  leadCount: number;
  teamCount: number;
  teamNames: Array<{ id: string; name: string; isPrimary: boolean }>;
};

/**
 * v3.2.0 — Sales-rep roster on v3 tokens.
 * Rows link into the new /sales/reps/[id] detail page where the manager
 * can deactivate, reassign leads, and inspect activity. Lead-count and
 * last-login moved out of the hire form into Badge + tabular columns.
 */
export function RepsList({ initialReps }: { initialReps: RepRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function hire() {
    if (!name.trim() || !email.trim()) {
      toast.error("Name + email required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role: Role.SALESPERSON,
          password: password.trim() || undefined,
          active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Hire failed");
        return;
      }
      if (data.inviteSent) toast.success("Rep created — invite email sent.");
      else toast.success(`Rep created. ${data.inviteSkipReason ?? "Share creds manually."}`, { duration: 8000 });
      setName("");
      setEmail("");
      setPassword("");
      setCreating(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink-strong tabular">{initialReps.length}</span> rep
          {initialReps.length === 1 ? "" : "s"}
          {initialReps.length > 0 && (
            <> · {initialReps.filter((r) => r.active).length} active</>
          )}
        </p>
        <Button size="sm" onClick={() => setCreating((c) => !c)}>
          {creating ? <X className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
          {creating ? "Cancel" : "New rep"}
        </Button>
      </div>

      {/* Hire form */}
      {creating && (
        <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5 space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rep-name">Name <span className="text-danger">*</span></Label>
              <Input id="rep-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lin Park" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rep-email">Email <span className="text-danger">*</span></Label>
              <Input
                id="rep-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="lin@gatewaytelnet.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rep-password">Initial password</Label>
              <Input
                id="rep-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="empty = magic-link only"
              />
            </div>
          </div>
          <p className="text-[11px] text-ink-faint">
            Role is fixed to <strong className="text-ink-muted">SALESPERSON</strong>. Ask a Superadmin to create other roles.
            If <code className="font-mono bg-surface-2 px-1 rounded text-ink-strong">RESEND_API_KEY</code> is configured the rep gets a welcome email; otherwise share creds manually.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={hire} disabled={saving || !name.trim() || !email.trim()} size="sm">
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {saving ? "Hiring…" : "Hire rep"}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state OR table */}
      {initialReps.length === 0 ? (
        <EmptyState
          Icon={UserPlus}
          title="No reps yet"
          body="Hire your first salesperson — they'll be able to see leads as soon as you add them to a team. Reps can belong to multiple teams; their primary team is where they land by default."
          cta={{ label: "Hire a rep", href: "#" }}
          secondaryCta={{ label: "Create a team first", href: "/sales/teams" }}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line-subtle bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="ui-label text-left px-4 py-2.5">Rep</th>
                <th className="ui-label text-left px-4 py-2.5 hidden md:table-cell">Teams</th>
                <th className="ui-label text-right px-4 py-2.5">Open leads</th>
                <th className="ui-label text-left px-4 py-2.5 hidden lg:table-cell">Last sign-in</th>
                <th className="ui-label text-left px-4 py-2.5">Status</th>
                <th className="ui-label text-right px-4 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {initialReps.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    "border-t border-line-subtle hover:bg-surface-3/40 transition-colors cursor-pointer group",
                    !r.active && "opacity-60",
                  )}
                  onClick={() => router.push(`/sales/reps/${r.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        aria-hidden
                        className="h-8 w-8 rounded-full bg-brand-soft text-gtn-navy flex items-center justify-center text-[11px] font-semibold flex-shrink-0 border border-line-subtle"
                      >
                        {initials(r.name)}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/sales/reps/${r.id}`}
                          className="text-sm font-semibold text-ink-strong hover:text-gtn-purple truncate block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.name}
                        </Link>
                        <p className="text-[11px] text-ink-muted font-mono truncate">{r.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {r.teamNames.length === 0 ? (
                      <Badge tone="warn" shape="pill" size="xs">No team</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.teamNames.slice(0, 3).map((t) => (
                          <Link
                            key={t.id}
                            href={`/sales/teams/${t.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] inline-flex items-center gap-0.5 bg-brand-soft text-gtn-navy rounded px-1.5 py-0.5 hover:bg-gtn-purple hover:text-white transition-colors"
                          >
                            {t.isPrimary && <Star className="h-2.5 w-2.5 text-gtn-amber" aria-label="Primary" />}
                            {t.name}
                          </Link>
                        ))}
                        {r.teamNames.length > 3 && (
                          <span className="text-[10px] text-ink-faint">+{r.teamNames.length - 3}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono tabular text-sm font-semibold text-ink-strong">{r.leadCount}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-ink-muted tabular">
                    {r.lastLoginAt ? formatDistanceToNow(new Date(r.lastLoginAt), { addSuffix: true }) : (
                      <span className="italic text-ink-faint">never</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={r.active ? "success" : "danger"} shape="pill" size="xs" dot>
                      {r.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ArrowRight className="h-3.5 w-3.5 text-ink-faint group-hover:text-gtn-purple transition-colors inline-block" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}
