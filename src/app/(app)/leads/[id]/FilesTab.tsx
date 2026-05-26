"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import { format } from "date-fns";
import {
  File,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Video as VideoIcon,
  Trash2,
  Upload,
  Camera,
  IdCard,
  ScrollText,
  Map as MapIcon,
  Cable,
  ReceiptText,
  ShieldCheck,
  FileQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  ATTACHMENT_CATEGORIES,
  attachmentCategoryLabel,
  formatBytes,
  isAllowedContentType,
  MAX_FILE_BYTES,
} from "@/lib/storage/blob";

/**
 * v3.3.13 — Files tab with categories + thumbnails.
 *
 * Rep picks a category before uploading; we PATCH it onto the
 * Attachment after the Blob upload completes (Vercel's two-stage
 * upload doesn't carry custom payload easily, so a follow-up PATCH
 * is cleaner). Images render inline thumbnails for instant scanning,
 * videos get a play-icon poster. Category filter chips at the top
 * let SE/vCIO jump straight to site photos / floor plans / etc.
 */

type Attachment = {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  publicUrl: string;
  category: string | null;
  caption: string | null;
  createdAt: string;
  uploadedBy: { name: string };
};

const CATEGORY_ICON: Record<string, typeof File> = {
  site_photo: Camera,
  site_video: VideoIcon,
  business_card: IdCard,
  flyer_marketing: ScrollText,
  floor_plan: MapIcon,
  equipment_photo: Cable,
  invoice_quote: ReceiptText,
  compliance_doc: ShieldCheck,
  document_other: FileQuestion,
};

function iconFor(ctype: string, category: string | null) {
  if (category && CATEGORY_ICON[category]) return CATEGORY_ICON[category];
  if (ctype.startsWith("video/")) return VideoIcon;
  if (ctype.startsWith("image/")) return ImageIcon;
  if (ctype.includes("spreadsheet") || ctype === "text/csv") return FileSpreadsheet;
  if (ctype === "application/pdf" || ctype.startsWith("text/")) return FileText;
  return File;
}

export function FilesTab({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Attachment[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<string>("site_photo");
  const [filter, setFilter] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/attachments`);
    const data = await res.json();
    if (res.ok) setItems(data.attachments);
  }, [leadId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function uploadFile(file: File) {
    if (!isAllowedContentType(file.type)) {
      toast.error(`Unsupported file type: ${file.type || "unknown"}`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`File too large (max ${formatBytes(MAX_FILE_BYTES)})`);
      return;
    }
    try {
      const result = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: `/api/leads/${leadId}/attachments/upload`,
        contentType: file.type,
      });
      // Wait briefly for the server-side onUploadCompleted callback to
      // write the Attachment row, then PATCH the category onto it.
      // We find the matching row by publicUrl since we don't have the id.
      await new Promise((r) => setTimeout(r, 500));
      try {
        const listRes = await fetch(`/api/leads/${leadId}/attachments`);
        const listData = await listRes.json();
        const created = (listData.attachments as Attachment[]).find((a) => a.publicUrl === result.url);
        if (created && pendingCategory) {
          await fetch(`/api/leads/${leadId}/attachments/${created.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category: pendingCategory }),
          });
        }
      } catch {
        // Category tagging is best-effort; the file is already saved.
      }
      toast.success(`Uploaded ${file.name}`);
      await refresh();
      router.refresh();
    } catch (err) {
      toast.error(`Upload failed: ${(err as Error).message}`);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      await uploadFile(f);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this file?")) return;
    const res = await fetch(`/api/leads/${leadId}/attachments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Delete failed");
      return;
    }
    toast.success("Deleted");
    await refresh();
    router.refresh();
  }

  async function changeCategory(id: string, category: string | null) {
    const res = await fetch(`/api/leads/${leadId}/attachments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Update failed");
      return;
    }
    await refresh();
  }

  const filteredItems = useMemo(() => {
    if (!items) return null;
    if (!filter) return items;
    return items.filter((a) => a.category === filter);
  }, [items, filter]);

  // Per-category counts for the filter chips
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of items ?? []) {
      const key = a.category ?? "__uncategorized__";
      m[key] = (m[key] ?? 0) + 1;
    }
    return m;
  }, [items]);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gtn-navy">Site files + media</h3>
          <p className="text-xs text-gtn-grey-2 mt-0.5">
            Photos of the server rack, business cards, floor plans, walkthrough videos — anything that gives the SE / vCIO a head start before they arrive.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pendingCategory}
            onChange={(e) => setPendingCategory(e.target.value)}
            className="h-9 rounded-md border border-line bg-surface px-2.5 text-xs text-ink-strong focus:outline-none focus:border-brand"
            title="Tag the next upload with this category"
          >
            {ATTACHMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" aria-hidden /> Upload
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt"
            onChange={(e) => onFiles(e.currentTarget.files)}
          />
        </div>
      </div>

      {/* Drag-and-drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void onFiles(e.dataTransfer.files);
        }}
        className={
          "border-2 border-dashed rounded-lg p-6 text-center mb-4 transition " +
          (dragging ? "border-gtn-purple bg-gtn-lavender" : "border-gtn-lavender-2 bg-transparent")
        }
      >
        <p className="text-sm text-gtn-grey-2">
          Drag files here, or click Upload. Next upload will be tagged as <strong>{attachmentCategoryLabel(pendingCategory) ?? pendingCategory}</strong>.
        </p>
        <p className="text-xs text-gtn-grey-3 mt-1">
          Images · Video · PDF · Office docs · CSV — up to {formatBytes(MAX_FILE_BYTES)}
        </p>
      </div>

      {/* Category filter chips */}
      {(items?.length ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={
              "text-[11px] px-2.5 py-1 rounded-full font-semibold transition-colors " +
              (filter === null
                ? "bg-gtn-purple text-white"
                : "bg-gtn-lavender text-gtn-grey-2 hover:text-gtn-navy")
            }
          >
            All ({items?.length ?? 0})
          </button>
          {ATTACHMENT_CATEGORIES.map((c) => {
            const n = counts[c.value] ?? 0;
            if (n === 0) return null;
            const isActive = filter === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setFilter(isActive ? null : c.value)}
                className={
                  "text-[11px] px-2.5 py-1 rounded-full font-semibold transition-colors " +
                  (isActive
                    ? "bg-gtn-purple text-white"
                    : "bg-gtn-lavender text-gtn-grey-2 hover:text-gtn-navy")
                }
              >
                {c.label} · {n}
              </button>
            );
          })}
        </div>
      )}

      {filteredItems === null ? (
        <p className="text-sm text-gtn-grey-2">Loading…</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-gtn-grey-2">
          {items && items.length > 0 ? "No files in this category." : "No files yet — upload photos, video, or docs above."}
        </p>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map((a) => {
            const Icon = iconFor(a.contentType, a.category);
            const isImage = a.contentType.startsWith("image/");
            const isVideo = a.contentType.startsWith("video/");
            return (
              <li key={a.id} className="rounded-lg border border-gtn-lavender-2 bg-surface overflow-hidden flex flex-col">
                <a href={a.publicUrl} target="_blank" rel="noreferrer" className="block aspect-video bg-surface-2 relative">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.publicUrl} alt={a.filename} className="absolute inset-0 w-full h-full object-cover" />
                  ) : isVideo ? (
                    <>
                      <video src={a.publicUrl} className="absolute inset-0 w-full h-full object-cover" preload="metadata" muted />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <VideoIcon className="h-10 w-10 text-white drop-shadow" />
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gtn-grey-2">
                      <Icon className="h-12 w-12" aria-hidden />
                    </div>
                  )}
                </a>
                <div className="p-3 flex-1 flex flex-col gap-1.5">
                  <a
                    className="text-xs font-medium text-gtn-navy hover:underline truncate block"
                    href={a.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={a.filename}
                  >
                    {a.filename}
                  </a>
                  <select
                    value={a.category ?? ""}
                    onChange={(e) => void changeCategory(a.id, e.target.value || null)}
                    className="h-7 rounded border border-gtn-lavender-2 px-1.5 text-[11px] bg-white text-ink-strong focus:outline-none focus:border-gtn-purple"
                  >
                    <option value="">— uncategorized —</option>
                    {ATTACHMENT_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gtn-grey-3 mt-auto pt-1">
                    {a.uploadedBy.name} · {format(new Date(a.createdAt), "MMM d")}
                    {a.byteSize > 0 ? ` · ${formatBytes(a.byteSize)}` : ""}
                  </p>
                </div>
                <div className="px-2 py-1.5 border-t border-gtn-lavender-2 flex justify-end">
                  <button
                    onClick={() => remove(a.id)}
                    className="text-[11px] text-gtn-grey-2 hover:text-gtn-red px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                    aria-label={`Delete ${a.filename}`}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden /> Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
