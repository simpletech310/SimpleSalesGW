"use client";

import { useCallback, useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { Camera, Loader2, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Attachment = {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  publicUrl: string;
  createdAt: string;
  uploadedBy: { id: string; name: string } | null;
};

/**
 * v2.23 — Polymorphic-attachment panel.
 *
 * Used on inventory asset forms, customer detail pages, and assessment
 * pages to attach photos + short videos. Accepts environment camera
 * input directly via the file input's `capture` attribute on mobile.
 */
export function MediaAttachments({
  entityType,
  entityId,
  label = "Photos / video",
  compact = false,
}: {
  entityType: string;
  entityId: string;
  label?: string;
  compact?: boolean;
}) {
  const [items, setItems] = useState<Attachment[] | null>(null);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/inventory-attachments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.attachments ?? []);
    } catch {
      setItems([]);
    }
  }, [entityType, entityId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let okCount = 0;
    let failCount = 0;
    try {
      for (const file of Array.from(files)) {
        try {
          await upload(file.name, file, {
            access: "public",
            handleUploadUrl: `/api/inventory-attachments/upload?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
            contentType: file.type || undefined,
          });
          okCount += 1;
        } catch (err) {
          failCount += 1;
          // eslint-disable-next-line no-console
          console.warn("[media-attach] upload failed:", err);
        }
      }
      if (okCount > 0) toast.success(`Uploaded ${okCount} file${okCount === 1 ? "" : "s"}`);
      if (failCount > 0) toast.error(`${failCount} upload${failCount === 1 ? "" : "s"} failed`);
      await refresh();
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this attachment?")) return;
    const res = await fetch(`/api/inventory-attachments?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Delete failed");
      return;
    }
    toast.success("Deleted");
    await refresh();
  }

  return (
    <div className={compact ? "" : "space-y-2"}>
      {!compact && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gtn-navy">{label}</p>
          <label className="inline-flex items-center gap-1 cursor-pointer">
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              // Hint to mobile browsers to prefer the rear camera
              // when the user taps the file input.
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }}
            />
            <Button type="button" size="sm" variant="secondary" disabled={uploading} asChild>
              <span>
                {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Camera className="h-3.5 w-3.5 mr-1" />}
                {uploading ? "Uploading…" : "Add photo / video"}
              </span>
            </Button>
          </label>
        </div>
      )}

      {items == null ? (
        <p className="text-xs text-gtn-grey-2 italic">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-gtn-grey-2 italic">No attachments yet.</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {items.map((a) => (
            <li key={a.id} className="relative group border border-gtn-lavender-2 rounded-md overflow-hidden bg-white">
              {a.contentType.startsWith("image/") ? (
                <a href={a.publicUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.publicUrl} alt={a.filename} className="w-full h-24 object-cover" />
                </a>
              ) : a.contentType.startsWith("video/") ? (
                <a href={a.publicUrl} target="_blank" rel="noreferrer" className="block">
                  <div className="w-full h-24 bg-gtn-lavender flex items-center justify-center">
                    <Video className="h-6 w-6 text-gtn-purple" />
                  </div>
                </a>
              ) : (
                <a href={a.publicUrl} target="_blank" rel="noreferrer" className="block w-full h-24 bg-gtn-lavender flex items-center justify-center text-xs text-gtn-grey-2 px-2 text-center">
                  {a.filename}
                </a>
              )}
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black"
                aria-label="Delete attachment"
              >
                <Trash2 className="h-3 w-3" />
              </button>
              <p className="text-[10px] text-gtn-grey-3 truncate px-1 py-0.5">{a.filename}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
