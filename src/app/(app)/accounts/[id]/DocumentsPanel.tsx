"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { upload } from "@vercel/blob/client";
import { SignedDocStatus, SignedDocType } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";

type Doc = {
  id: string;
  type: SignedDocType;
  title: string;
  status: SignedDocStatus;
  signedByName: string | null;
  signedByEmail: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  publicUrl: string | null;
  notes: string | null;
  uploadedBy: { name: string };
  createdAt: string;
};

const TYPE_LABELS: Record<SignedDocType, string> = {
  MSA: "MSA",
  SOW: "SOW",
  BAA: "BAA",
  NDA: "NDA",
  DPA: "DPA",
  AMENDMENT: "Amendment",
  OTHER: "Other",
};

export function DocumentsPanel({
  scope,
  parentId,
}: {
  scope: "lead" | "customer";
  parentId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Doc[] | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const baseUrl = scope === "lead"
    ? `/api/leads/${parentId}/documents`
    : `/api/accounts/${parentId}/documents`;

  const refresh = useCallback(async () => {
    const res = await fetch(baseUrl);
    const data = await res.json();
    if (res.ok) setItems(data.documents);
  }, [baseUrl]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/documents/upload",
        clientPayload: JSON.stringify({ scope, parentId }),
      });
      setUploadedUrl(blob.url);
      setUploadedName(file.name);
      if (urlInputRef.current) urlInputRef.current.value = blob.url;
      if (titleInputRef.current && !titleInputRef.current.value) {
        // Auto-suggest a title from the filename
        titleInputRef.current.value = file.name.replace(/\.[^.]+$/, "");
      }
      toast.success("File uploaded — fill in metadata and save");
    } catch (err) {
      toast.error((err as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function resetForm(form: HTMLFormElement) {
    form.reset();
    setUploadedUrl(null);
    setUploadedName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function create(form: HTMLFormElement) {
    setSaving(true);
    try {
      const fd = new FormData(form);
      const payload: Record<string, unknown> = {
        type: fd.get("type"),
        title: fd.get("title"),
        status: fd.get("status") || undefined,
        signedByName: fd.get("signedByName") || undefined,
        signedByEmail: fd.get("signedByEmail") || undefined,
        signedAt: fd.get("signedAt") ? new Date(fd.get("signedAt") as string).toISOString() : undefined,
        expiresAt: fd.get("expiresAt") ? new Date(fd.get("expiresAt") as string).toISOString() : undefined,
        publicUrl: fd.get("publicUrl") || undefined,
        notes: fd.get("notes") || undefined,
      };
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data?.error ?? "Failed");
      else {
        toast.success("Document added");
        setOpen(false);
        resetForm(form);
        await refresh();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function markSigned(d: Doc) {
    const name = prompt("Signed by (name)?", d.signedByName ?? "");
    if (!name) return;
    const dt = prompt("Signed date (YYYY-MM-DD, blank = today)?");
    const signedAt = dt ? new Date(dt).toISOString() : new Date().toISOString();
    const res = await fetch(`/api/documents/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: SignedDocStatus.SIGNED,
        signedByName: name,
        signedAt,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Failed");
      return;
    }
    toast.success("Marked signed");
    await refresh();
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this document record?")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Delete failed");
      return;
    }
    toast.success("Deleted");
    await refresh();
    router.refresh();
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gtn-navy">Signed documents</h3>
        <Button size="sm" onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Add document"}</Button>
      </div>

      {open && (
        <form
          onSubmit={(e) => { e.preventDefault(); void create(e.currentTarget); }}
          className="space-y-3 mb-4 p-3 rounded-md bg-gtn-lavender"
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Type *</Label>
              <select name="type" required className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                {(Object.values(SignedDocType) as SignedDocType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Title *</Label>
              <Input name="title" ref={titleInputRef} required maxLength={200} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <select name="status" className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                {(Object.values(SignedDocStatus) as SignedDocStatus[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">File (optional — uploads to secure storage)</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                  className="text-xs"
                />
                {uploading && <span className="text-xs text-gtn-grey-2">Uploading…</span>}
                {uploadedUrl && !uploading && (
                  <span className="text-xs text-gtn-green">✓ {uploadedName}</span>
                )}
              </div>
              <Label className="text-xs mt-2">Or paste a public URL</Label>
              <Input
                name="publicUrl"
                ref={urlInputRef}
                type="url"
                placeholder="https://…"
                defaultValue={uploadedUrl ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Signed by (name)</Label>
              <Input name="signedByName" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Signed by (email)</Label>
              <Input name="signedByEmail" type="email" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Signed on</Label>
              <Input name="signedAt" type="date" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expires on</Label>
              <Input name="expiresAt" type="date" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || uploading}>
              {saving ? "Saving…" : uploading ? "Wait — uploading file…" : "Add document"}
            </Button>
          </div>
        </form>
      )}

      {items === null ? (
        <p className="text-sm text-gtn-grey-2">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gtn-grey-2">No documents tracked yet.</p>
      ) : (
        <ul className="divide-y divide-gtn-lavender-2">
          {items.map((d) => (
            <li key={d.id} className="py-3 text-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-gtn-navy">
                    <span className="inline-block bg-gtn-purple text-white text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 mr-2">
                      {TYPE_LABELS[d.type]}
                    </span>
                    {d.publicUrl ? (
                      <a className="hover:underline" href={d.publicUrl} target="_blank" rel="noreferrer">{d.title}</a>
                    ) : d.title}
                  </p>
                  <p className="text-xs text-gtn-grey-2">
                    {d.signedByName && <>Signed by {d.signedByName} · </>}
                    {d.signedAt && <>{format(new Date(d.signedAt), "PPP")} · </>}
                    {d.expiresAt && <>expires {format(new Date(d.expiresAt), "PPP")} · </>}
                    {d.uploadedBy.name} · {format(new Date(d.createdAt), "PPp")}
                  </p>
                  {d.notes && <p className="text-xs text-gtn-grey-2 mt-1">{d.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={d.status} expiresAt={d.expiresAt} />
                  {d.status !== SignedDocStatus.SIGNED && d.status !== SignedDocStatus.EXPIRED && (
                    <Button size="sm" variant="secondary" onClick={() => markSigned(d)}>Mark signed</Button>
                  )}
                  <button
                    onClick={() => remove(d.id)}
                    className="text-xs text-gtn-red hover:underline"
                  >
                    delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StatusPill({ status, expiresAt }: { status: SignedDocStatus; expiresAt: string | null }) {
  const isExpired = expiresAt && new Date(expiresAt) < new Date();
  const effective = isExpired && status !== SignedDocStatus.SUPERSEDED ? SignedDocStatus.EXPIRED : status;
  const cls =
    effective === SignedDocStatus.SIGNED ? "bg-gtn-green-bg text-gtn-green"
      : effective === SignedDocStatus.EXPIRED ? "bg-[#FBE9E7] text-gtn-red"
      : effective === SignedDocStatus.SUPERSEDED ? "bg-gtn-lavender text-gtn-grey-2"
      : effective === SignedDocStatus.SENT ? "bg-[#FEF3E2] text-gtn-amber"
      : "bg-gtn-lavender text-gtn-navy";
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${cls}`}>
      {effective}
    </span>
  );
}
