"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, X, Mail, Phone, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldHint } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

/**
 * v3.0.5 — Inline-editable profile form on /me.
 *
 * Read-only state shows name + phone as plain rows with an "Edit" pencil
 * in the corner. Pressing Edit swaps to a form with Save / Cancel.
 * Email + role are always read-only — email is the auth identity (would
 * break sessions), role is admin-controlled.
 */
type Initial = {
  name: string;
  phone: string | null;
  email: string;
  role: string;
};

export function MeProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({
    name: initial.name,
    phone: initial.phone ?? "",
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (values.name.trim().length < 1) {
      toast.error("Name can't be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name.trim(), phone: values.phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to save");
        return;
      }
      toast.success("Profile saved");
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setValues({ name: initial.name, phone: initial.phone ?? "" });
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink-strong">Profile details</h3>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>
            <X className="h-3.5 w-3.5 mr-1.5" />
            Cancel
          </Button>
        )}
      </header>

      {!editing ? (
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3.5">
          <Row icon={Mail}  label="Email" value={initial.email} hint="Read-only — this is your sign-in identity." />
          <Row icon={Shield} label="Role" value={initial.role}  hint="Managed by admins." />
          <Row icon={Mail}  label="Name"  value={initial.name} />
          <Row icon={Phone} label="Phone" value={initial.phone || <span className="text-ink-faint italic">Not set</span>} />
        </dl>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Read-only — email + role */}
            <ReadOnlyField label="Email" value={initial.email} hint="Sign-in identity — change requires admin." />
            <ReadOnlyField label="Role"  value={initial.role}  hint="Managed by admins." />

            {/* Editable */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name <span className="text-danger">*</span></Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                value={values.name}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                disabled={saving}
              />
              <FieldHint>How your name appears throughout the portal.</FieldHint>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                maxLength={40}
                placeholder="(555) 555-5555"
                value={values.phone}
                onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
                disabled={saving}
              />
              <FieldHint>Used by the team to reach you directly.</FieldHint>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
            <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Mail;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3")}>
      <span
        aria-hidden
        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-3 text-ink-muted flex-shrink-0 mt-0.5"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="ui-label">{label}</dt>
        <dd className="text-sm text-ink-strong font-medium mt-0.5">{value}</dd>
        {hint && <p className="text-[11px] text-ink-faint mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div
        className={cn(
          "flex h-9 items-center rounded-md border border-line-subtle bg-surface-2 px-3 text-sm text-ink-muted",
        )}
      >
        {value}
      </div>
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}
