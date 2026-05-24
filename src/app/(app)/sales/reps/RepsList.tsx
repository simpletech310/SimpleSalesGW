"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Star } from "lucide-react";
import { Role } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

type RepRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  lastLoginAt: string | null;
  leadCount: number;
  teamCount: number;
  teamNames: Array<{ name: string; isPrimary: boolean }>;
};

export function RepsList({ initialReps }: { initialReps: RepRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function hire() {
    if (!name.trim() || !email.trim()) { toast.error("Name + email required."); return; }
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
      if (!res.ok) { toast.error(data?.error ?? "Hire failed"); return; }
      if (data.inviteSent) toast.success("Rep created — invite email sent.");
      else toast.success(`Rep created. ${data.inviteSkipReason ?? "Share creds manually."}`, { duration: 8000 });
      setName(""); setEmail(""); setPassword(""); setCreating(false);
      router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating((c) => !c)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {creating ? "Cancel" : "New rep"}
        </Button>
      </div>

      {creating && (
        <Card>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lin Park" />
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="lin@gatewaytelnet.com" />
            </div>
            <div className="space-y-1">
              <Label>Initial password (optional)</Label>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="empty = magic-link only" />
            </div>
          </div>
          <p className="text-[11px] text-gtn-grey-3 mt-2">
            Role is fixed to <strong>SALESPERSON</strong>. Ask a Superadmin to create other roles.
            If RESEND_API_KEY is configured the rep gets a welcome email; otherwise share creds manually.
          </p>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={saving}>Cancel</Button>
            <Button onClick={hire} disabled={saving || !name.trim() || !email.trim()}>
              {saving ? "Hiring…" : "Hire rep"}
            </Button>
          </div>
        </Card>
      )}

      {initialReps.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gtn-lavender text-left text-xs uppercase tracking-wide text-gtn-grey-2">
              <tr>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Teams</th>
                <th className="px-3 py-3 text-right">Leads</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gtn-lavender-2">
              {initialReps.map((r) => (
                <tr key={r.id} className={r.active ? "" : "opacity-50"}>
                  <td className="px-3 py-2 font-medium text-gtn-navy">{r.name}</td>
                  <td className="px-3 py-2 text-xs font-mono">{r.email}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.teamNames.length === 0 ? (
                      <span className="text-gtn-grey-3 italic">no team</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 flex-wrap">
                        {r.teamNames.map((t, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5">
                            {t.isPrimary && <Star className="h-3 w-3 text-gtn-amber" aria-label="Primary" />}
                            {t.name}
                            {i < r.teamNames.length - 1 && ","}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{r.leadCount}</td>
                  <td className="px-3 py-2">
                    {r.active ? (
                      <span className="text-[10px] uppercase font-semibold tracking-wide rounded-full px-2 py-0.5 bg-gtn-green-bg text-gtn-green">active</span>
                    ) : (
                      <span className="text-[10px] uppercase font-semibold tracking-wide rounded-full px-2 py-0.5 bg-gtn-lavender text-gtn-grey-2">inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
