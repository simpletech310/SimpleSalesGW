"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

type U = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
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

    // v2.14 — branch the toast on whether the invite email actually sent.
    // Without this signal, the SUPERADMIN doesn't know they need to share
    // credentials with the new user manually.
    toast.success("User created");
    if (data.inviteSent) {
      toast.message("Invite email sent — they'll see it in their inbox.", {
        duration: 5000,
      });
    } else if (data.inviteSkipReason) {
      toast.warning(`No invite email: ${data.inviteSkipReason}`, {
        duration: 8000,
      });
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ New user"}</Button>
      </div>
      {open && (
        <Card>
          <form
            onSubmit={(e) => { e.preventDefault(); void create(e.currentTarget); }}
            className="space-y-3"
          >
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" required /></div>
              <div className="space-y-2"><Label>Name</Label><Input name="name" required /></div>
              <div className="space-y-2">
                <Label>Role</Label>
                <select name="role" defaultValue={Role.SALESPERSON} className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                  {Object.values(Role).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Initial password (optional)</Label><Input name="password" type="password" minLength={8} /></div>
            </div>
            <div className="flex justify-end"><Button type="submit">Create</Button></div>
          </form>
        </Card>
      )}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gtn-lavender text-left text-xs uppercase tracking-wide text-gtn-grey-2">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Last login</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gtn-lavender-2">
                <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3">
                  <select
                    defaultValue={u.role}
                    onChange={(e) => patch(u.id, { role: e.target.value as Role })}
                    className="h-8 rounded border border-input bg-white px-2 text-xs"
                  >
                    {Object.values(Role).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => patch(u.id, { active: !u.active })}
                    className={u.active ? "text-gtn-green text-xs" : "text-gtn-red text-xs"}
                  >
                    {u.active ? "active" : "deactivated"}
                  </button>
                </td>
                <td className="px-4 py-3 text-gtn-grey-2 text-xs">{u.lastLoginAt ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
