"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Role } from "@prisma/client";

type AssignableUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/**
 * AccountManagerPicker — small inline editor on the Account detail page.
 * Renders the current account manager as a label with an "Edit" link; on
 * click expands to a dropdown of assignable users (VCIO + COO + SUPERADMIN
 * by default). PATCHes /api/accounts/[id] with accountManagerId. Gated by
 * onboarding:manage at the API.
 */
export function AccountManagerPicker({
  customerId,
  currentManagerId,
  currentManagerName,
  canEdit,
}: {
  customerId: string;
  currentManagerId: string | null;
  currentManagerName: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [users, setUsers] = useState<AssignableUser[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing || users !== null) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/users/assignable?roles=VCIO,COO,SUPERADMIN,SALES_MANAGER");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setUsers(data.users);
    })();
    return () => { cancelled = true; };
  }, [editing, users]);

  async function pick(newId: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountManagerId: newId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? "Failed"); return; }
      toast.success(newId ? "Account manager updated" : "Account manager unassigned");
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return <span>{currentManagerName ?? "Unassigned"}</span>;
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span>{currentManagerName ?? "Unassigned"}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[10px] text-gtn-purple hover:underline"
        >
          edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={currentManagerId ?? ""}
        onChange={(e) => pick(e.target.value || null)}
        disabled={saving || users === null}
        className="h-8 rounded border border-input bg-white px-2 text-sm"
      >
        <option value="">— Unassigned —</option>
        {users?.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.role.replace(/_/g, " ")})
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={saving}
        className="text-xs text-gtn-grey-2 hover:text-gtn-navy"
      >
        cancel
      </button>
    </div>
  );
}
