"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { upload } from "@vercel/blob/client";
import { FileText, Loader2, Plus, Trash2, X } from "lucide-react";
import { SignedDocStatus, SignedDocType } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/help/EmptyState";

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

/**
 * v3.1.4 — Documents panel on v3 tokens + Badge + branded EmptyState.
 */
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
    <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-strong">Signed documents</h3>
        <Button size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? <X className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
          {open ? "Cancel" : "Add document"}
        </Button>
      </div>

      {open && (
        <form
          onSubmit={(e) => { e.preventDefault(); void create(e.currentTarget); }}
          className="space-y-4 mb-4 p-4 rounded-lg border border-line-subtle bg-surface-2/50"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-type">Type <span className="text-danger">*</span></Label>
              <select
                id="doc-type"
                name="type"
                required
                className="flex h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink-strong hover:border-line-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
              >
                {(Object.values(SignedDocType) as SignedDocType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-title">Title <span className="text-danger">*</span></Label>
              <Input id="doc-title" name="title" ref={titleInputRef} required maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-status">Status</Label>
              <select
                id="doc-status"
                name="status"
                className="flex h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink-strong hover:border-line-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
              >
                {(Object.values(SignedDocStatus) as SignedDocStatus[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>File (uploads to secure storage)</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                  className="text-xs text-ink-muted file:mr-2 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink-strong hover:file:bg-surface-3"
                />
                {uploading && (
                  <span className="text-xs text-ink-muted inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading…
                  </span>
                )}
                {uploadedUrl && !uploading && (
                  <span className="text-xs text-gtn-green inline-flex items-center gap-1">
                    ✓ {uploadedName}
                  </span>
                )}
              </div>
              <Label htmlFor="doc-url" className="mt-2">Or paste a public URL</Label>
              <Input
                id="doc-url"
                name="publicUrl"
                ref={urlInputRef}
                type="url"
                placeholder="https://…"
                defaultValue={uploadedUrl ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-signed-name">Signed by (name)</Label>
              <Input id="doc-signed-name" name="signedByName" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-signed-email">Signed by (email)</Label>
              <Input id="doc-signed-email" name="signedByEmail" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-signed-at">Signed on</Label>
              <Input id="doc-signed-at" name="signedAt" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-expires-at">Expires on</Label>
              <Input id="doc-expires-at" name="expiresAt" type="date" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-notes">Notes</Label>
            <Textarea id="doc-notes" name="notes" rows={2} />
          </div>
          <div className="flex justify-end pt-2 border-t border-line-subtle">
            <Button type="submit" size="sm" disabled={saving || uploading}>
              {(saving || uploading) && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {saving ? "Saving…" : uploading ? "Wait — uploading…" : "Add document"}
            </Button>
          </div>
        </form>
      )}

      {items === null ? (
        <div className="flex items-center justify-center py-8 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          Icon={FileText}
          title="No documents tracked yet"
          body="Upload signed MSAs, SOWs, BAAs and amendments here. Once added you can mark them signed, track expirations, and link the original file."
        />
      ) : (
        <ul className="divide-y divide-line-subtle border-t border-line-subtle">
          {items.map((d) => (
            <li key={d.id} className="py-3 text-sm">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone="accent" shape="pill" size="xs">{TYPE_LABELS[d.type]}</Badge>
                    {d.publicUrl ? (
                      <a
                        className="text-sm font-medium text-ink-strong hover:text-gtn-purple hover:underline"
                        href={d.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {d.title}
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-ink-strong">{d.title}</span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted mt-1">
                    {d.signedByName && <>Signed by {d.signedByName} · </>}
                    {d.signedAt && <>{format(new Date(d.signedAt), "PPP")} · </>}
                    {d.expiresAt && <>expires {format(new Date(d.expiresAt), "PPP")} · </>}
                    {d.uploadedBy.name} · {format(new Date(d.createdAt), "PPp")}
                  </p>
                  {d.notes && <p className="text-xs text-ink-muted mt-1.5 italic">{d.notes}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={d.status} expiresAt={d.expiresAt} />
                  {d.status !== SignedDocStatus.SIGNED && d.status !== SignedDocStatus.EXPIRED && (
                    <Button size="sm" variant="secondary" onClick={() => markSigned(d)}>Mark signed</Button>
                  )}
                  <button
                    onClick={() => remove(d.id)}
                    className="text-ink-faint hover:text-danger transition-colors p-1"
                    aria-label="Delete document"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status, expiresAt }: { status: SignedDocStatus; expiresAt: string | null }) {
  const isExpired = expiresAt && new Date(expiresAt) < new Date();
  const effective = isExpired && status !== SignedDocStatus.SUPERSEDED ? SignedDocStatus.EXPIRED : status;
  const tone: "success" | "danger" | "neutral" | "warn" | "brand" =
    effective === SignedDocStatus.SIGNED ? "success"
      : effective === SignedDocStatus.EXPIRED ? "danger"
      : effective === SignedDocStatus.SUPERSEDED ? "neutral"
      : effective === SignedDocStatus.SENT ? "warn"
      : "brand";
  return (
    <Badge tone={tone} shape="pill" size="xs" dot>
      {effective.toLowerCase()}
    </Badge>
  );
}
