"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import { format } from "date-fns";
import { File, FileText, Image as ImageIcon, FileSpreadsheet, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatBytes, isAllowedContentType, MAX_FILE_BYTES } from "@/lib/storage/blob";

type Attachment = {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  publicUrl: string;
  createdAt: string;
  uploadedBy: { name: string };
};

function iconFor(ctype: string) {
  if (ctype.startsWith("image/")) return ImageIcon;
  if (ctype.includes("spreadsheet") || ctype === "text/csv") return FileSpreadsheet;
  if (ctype === "application/pdf" || ctype.startsWith("text/")) return FileText;
  return File;
}

export function FilesTab({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Attachment[] | null>(null);
  const [dragging, setDragging] = useState(false);
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
      await upload(file.name, file, {
        access: "public",
        handleUploadUrl: `/api/leads/${leadId}/attachments/upload`,
        contentType: file.type,
      });
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

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gtn-navy">Files</h3>
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" aria-hidden /> Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.currentTarget.files)}
        />
      </div>

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
        <p className="text-sm text-gtn-grey-2">Drag files here, or click Upload.</p>
        <p className="text-xs text-gtn-grey-3 mt-1">PDF · DOCX · XLSX · PPTX · CSV · images — up to {formatBytes(MAX_FILE_BYTES)}</p>
      </div>

      {items === null ? (
        <p className="text-sm text-gtn-grey-2">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gtn-grey-2">No files yet.</p>
      ) : (
        <ul className="divide-y divide-gtn-lavender-2">
          {items.map((a) => {
            const Icon = iconFor(a.contentType);
            return (
              <li key={a.id} className="flex items-center justify-between py-3 gap-3">
                <Icon className="h-5 w-5 text-gtn-purple flex-shrink-0" aria-hidden />
                <div className="flex-1 min-w-0">
                  <a className="text-sm font-medium text-gtn-navy hover:underline truncate block" href={a.publicUrl} target="_blank" rel="noreferrer">
                    {a.filename}
                  </a>
                  <p className="text-xs text-gtn-grey-3">
                    {a.uploadedBy.name} · {format(new Date(a.createdAt), "PPp")}
                    {a.byteSize > 0 ? ` · ${formatBytes(a.byteSize)}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => remove(a.id)}
                  className="p-2 rounded hover:bg-gtn-lavender text-gtn-grey-2 hover:text-gtn-red"
                  aria-label={`Delete ${a.filename}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
