"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type U = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

/**
 * v3.1.2 — Users admin redesigned.
 *
 * Was: gtn-* legacy tokens, basic table, plain "active/deactivated"
 * text button. Now: v3 tokens (line-subtle, surface), role Badge with
 * tone per role, active state as a tone-tinted Badge button.
 */
const ROLE_LABEL: Record<Role, string> = {
  SALESPERSON:    "Salesperson",
  SALES_MANAGER:  "Sales Manager",
  VCIO:           "vCIO",
  COO:            "COO",
  SUPERADMIN:     "Superadmin",
};

const ROLE_TONE: Record<Role, "brand" | "navy" | "warn" | "neutral" | "accent"> = {
  SALESPERSON:    "brand",
  SALES_MANAGER:  "accent",
  VCIO:           "navy",
  COO:            "navy",
  SUPERADMIN:     "warn",
};

export function UserManager({ initialUsers }: { initialUsers: U[] }) {
  const router = useRouter();
  const [users, setUsers] = useState<U[]>(initialUsers);
  const [open, setOpen] = useState(false);

  async function patch(id: string, body: Partial<U>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) toast.error(data?.error ?? "Failed");
    else {
      toast.success("Updated");
      setUsers((cur) => cur.map((u) => (u.id === id ? { ...u, ...body } as U : u)));
      router.refresh();
    }
  }

  async function create(form: HTMLFormElement) {
    const fd = new FormData(form);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: fd.get("email"),
        name: fd.get("name"),
        role: fd.get("role"),
        password: fd.get("password") || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data?.error ?? "Failed");
      return;
    }
    toast.success("User created");
    if (data.inviteSent) {
      toast.message("Invite email sent — they'll see it in their inbox.", { duration: 5000 });
    } else if (data.inviteSkipReason) {
      toast.warning(`No invite email: ${data.inviteSkipReason}`, { duration: 8000 });
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink-strong tabular">{users.length}</span> total{" "}
          · {users.filter((u) => u.active).length} active
        </p>
        <Button size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? <X className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
          {open ? "Cancel" : "New user"}
        </Button>
      </div>

      {/* Create form */}
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create(e.currentTarget);
          }}
          className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5 space-y-4"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email <span className="text-danger">*</span></Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name <span className="text-danger">*</span></Label>
              <Input id="name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                defaultValue={Role.SALESPERSON}
                className="flex h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink-strong hover:border-line-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
              >
                {Object.values(Role).map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Initial password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                placeholder="Optional — magic-link only if blank"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">Create user</Button>
          </div>
        </form>
      )}

      {/* Users table */}
      <div className="overflow-x-auto rounded-xl border border-line-subtle bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2">
            <tr>
              <th className="ui-label text-left px-4 py-2.5">User</th>
              <th className="ui-label text-left px-4 py-2.5 hidden md:table-cell">Role</th>
              <th className="ui-label text-left px-4 py-2.5">Status</th>
              <th className="ui-label text-left px-4 py-2.5 hidden md:table-cell">Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line-subtle hover:bg-surface-3/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      aria-hidden
                      className="h-8 w-8 rounded-full bg-brand-soft text-gtn-navy flex items-center justify-center text-[11px] font-semibold flex-shrink-0 border border-line-subtle"
                    >
                      {initials(u.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-strong truncate">{u.name}</p>
                      <p className="text-[11px] text-ink-muted font-mono truncate">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <select
                    defaultValue={u.role}
                    onChange={(e) => patch(u.id, { role: e.target.value as Role })}
                    className={cn(
                      "h-7 rounded-full border px-2.5 text-xs font-medium cursor-pointer",
                      "hover:border-line-strong",
                      "focus:outline-none focus:ring-2 focus:ring-brand/30",
                      "transition-colors duration-120 ease-smooth",
                      // Mimic Badge tone via classes
                      ROLE_TONE[u.role] === "brand"   && "bg-brand-soft text-gtn-navy border-transparent",
                      ROLE_TONE[u.role] === "accent"  && "bg-gtn-purple text-white border-transparent",
                      ROLE_TONE[u.role] === "navy"    && "bg-gtn-navy text-white border-transparent",
                      ROLE_TONE[u.role] === "warn"    && "bg-warn-soft text-gtn-amber border-transparent",
                      ROLE_TONE[u.role] === "neutral" && "bg-surface-3 text-ink-strong border-line-subtle",
                    )}
                    aria-label={`Change role for ${u.name}`}
                  >
                    {Object.values(Role).map((r) => (
                      <option key={r} value={r} className="bg-surface text-ink-strong">
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => patch(u.id, { active: !u.active })}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                      u.active
                        ? "bg-success-soft text-gtn-green hover:bg-success-soft/80"
                        : "bg-danger-soft text-gtn-red hover:bg-danger-soft/80",
                    )}
                    title={u.active ? "Click to deactivate" : "Click to reactivate"}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "inline-block w-1.5 h-1.5 rounded-full",
                        u.active ? "bg-gtn-green" : "bg-gtn-red",
                      )}
                    />
                    {u.active ? "Active" : "Deactivated"}
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted hidden md:table-cell tabular">
                  {u.lastLoginAt ?? <span className="text-ink-faint italic">never</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
