"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Callout } from "@/components/brand";

type RowResult = {
  rowIndex: number;
  raw: Record<string, string>;
  normalized?: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  status?: "created" | "skipped_duplicate" | "error";
  leadId?: string;
};

type PreviewResponse = {
  mode: "preview";
  total: number;
  valid: number;
  invalid: number;
  headers: string[];
  results: RowResult[];
};

type CreateResponse = {
  mode: "create";
  total: number;
  created: number;
  skippedDuplicate: number;
  errors: number;
  ownerUserId: string;
  results: RowResult[];
};

const SAMPLE_CSV = `businessName,industry,seatCount,siteCount,addressCity,addressState,websiteUrl,primaryContactName,primaryContactEmail,primaryContactPhone
Acme Manufacturing,MANUFACTURING,45,1,Burbank,CA,https://acme.example.com,Jane Doe,jane@acme.example.com,(818) 555-1234
Riverside Dental,MEDICAL,12,1,Riverside,CA,https://riversidedental.example.com,Dr. Smith,office@riversidedental.example.com,(951) 555-7890`;

export function BulkImportClient({ canAssign }: { canAssign: boolean }) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [created, setCreated] = useState<CreateResponse | null>(null);

  async function readFile(file: File) {
    setFilename(file.name);
    const text = await file.text();
    setCsv(text);
    setPreview(null);
    setCreated(null);
  }

  async function runPreview() {
    setBusy(true);
    setCreated(null);
    try {
      const res = await fetch("/api/leads/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, mode: "preview", ownerEmail: ownerEmail || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Preview failed");
        return;
      }
      setPreview(data);
      toast.success(`${data.valid} valid, ${data.invalid} with errors`);
    } finally {
      setBusy(false);
    }
  }

  async function runCreate() {
    if (!preview || preview.valid === 0) return;
    if (!confirm(`Create ${preview.valid} lead${preview.valid === 1 ? "" : "s"}? Duplicates by business name will be skipped.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/leads/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, mode: "create", ownerEmail: ownerEmail || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Import failed");
        return;
      }
      setCreated(data);
      toast.success(`${data.created} created · ${data.skippedDuplicate} duplicates skipped · ${data.errors} errors`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function loadSample() {
    setCsv(SAMPLE_CSV);
    setFilename("sample.csv");
    setPreview(null);
    setCreated(null);
  }

  return (
    <div className="space-y-5">
      <Callout kind="tip">
        Accepted columns include: <code className="gtn-code-pill">businessName</code> (required),{" "}
        <code className="gtn-code-pill">industry</code>, <code className="gtn-code-pill">seatCount</code>,{" "}
        <code className="gtn-code-pill">siteCount</code>, <code className="gtn-code-pill">addressCity</code>,{" "}
        <code className="gtn-code-pill">addressState</code>, <code className="gtn-code-pill">addressZip</code>,{" "}
        <code className="gtn-code-pill">websiteUrl</code>, <code className="gtn-code-pill">primaryContactName</code>,{" "}
        <code className="gtn-code-pill">primaryContactEmail</code>, <code className="gtn-code-pill">primaryContactPhone</code>,{" "}
        <code className="gtn-code-pill">currentMspName</code>, and{" "}
        <code className="gtn-code-pill">notes</code>. Common synonyms work too (Company, Phone, Employees, City, State,
        etc.). Max 500 rows per file — split larger imports.
      </Callout>

      <Card>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-gtn-navy">1. Upload CSV</h3>
            <Button type="button" size="sm" variant="ghost" onClick={loadSample}>
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Try a sample
            </Button>
          </div>
          <label className="block">
            <div className="flex items-center gap-2 rounded-md border border-dashed border-line-strong bg-surface-2 px-4 py-6 cursor-pointer hover:border-brand transition-colors">
              <Upload className="h-5 w-5 text-gtn-purple" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gtn-navy">
                  {filename ? filename : "Choose a CSV file"}
                </p>
                <p className="text-xs text-ink-muted mt-0.5">
                  First row should be headers. UTF-8 encoded.
                </p>
              </div>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
              }}
            />
          </label>

          {csv && (
            <details>
              <summary className="cursor-pointer text-xs text-gtn-grey-2 hover:text-gtn-navy">
                Show raw CSV ({csv.split("\n").length - 1} rows)
              </summary>
              <pre className="mt-2 text-[11px] bg-surface-2 border border-line-subtle rounded p-2 overflow-x-auto max-h-48">{csv}</pre>
            </details>
          )}

          {canAssign && (
            <div>
              <label htmlFor="ownerEmail" className="text-xs font-semibold text-gtn-navy block mb-1">
                Assign imported leads to (email)
              </label>
              <Input
                id="ownerEmail"
                type="email"
                placeholder="lin@gatewaytelnet.com (leave blank to assign to yourself)"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" size="sm" onClick={runPreview} disabled={!csv || busy}>
              {busy && !preview ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Validate &amp; preview
            </Button>
          </div>
        </div>
      </Card>

      {preview && (
        <Card>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-gtn-navy">2. Review</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  {preview.valid} valid · {preview.invalid} need fixing · {preview.total} total
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={runCreate}
                disabled={busy || preview.valid === 0}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                Create {preview.valid} lead{preview.valid === 1 ? "" : "s"}
              </Button>
            </div>

            <div className="overflow-x-auto rounded border border-line-subtle">
              <table className="w-full text-xs">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="ui-label text-left px-3 py-2">Row</th>
                    <th className="ui-label text-left px-3 py-2">Business</th>
                    <th className="ui-label text-left px-3 py-2">Industry</th>
                    <th className="ui-label text-right px-3 py-2">Seats</th>
                    <th className="ui-label text-left px-3 py-2">Location</th>
                    <th className="ui-label text-left px-3 py-2">Contact</th>
                    <th className="ui-label text-left px-3 py-2">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.results.slice(0, 200).map((r) => {
                    const ok = r.errors.length === 0;
                    const n = r.normalized ?? {};
                    return (
                      <tr key={r.rowIndex} className={`border-t border-line-subtle ${!ok ? "bg-gtn-red/5" : ""}`}>
                        <td className="px-3 py-1.5 tabular text-ink-muted">{r.rowIndex}</td>
                        <td className="px-3 py-1.5 font-medium text-gtn-navy">{String(n.businessName ?? r.raw.businessName ?? "—")}</td>
                        <td className="px-3 py-1.5 text-ink-muted">{String(n.industry ?? r.raw.industry ?? "—")}</td>
                        <td className="px-3 py-1.5 text-right tabular">{String(n.seatCount ?? "—")}</td>
                        <td className="px-3 py-1.5 text-ink-muted">{[n.addressCity, n.addressState].filter(Boolean).join(", ") || "—"}</td>
                        <td className="px-3 py-1.5 text-ink-muted">{String(n.primaryContactEmail ?? n.primaryContactPhone ?? "—")}</td>
                        <td className="px-3 py-1.5">
                          {r.errors.length > 0 && (
                            <div className="text-gtn-red flex items-start gap-1">
                              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span>{r.errors.join("; ")}</span>
                            </div>
                          )}
                          {r.warnings.length > 0 && (
                            <div className="text-gtn-amber text-[11px] mt-0.5">
                              {r.warnings.slice(0, 2).join("; ")}
                              {r.warnings.length > 2 && <> · +{r.warnings.length - 2} more</>}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {preview.results.length > 200 && (
              <p className="text-xs text-ink-muted text-center pt-1">
                Showing first 200 of {preview.results.length} rows. Validation runs on all.
              </p>
            )}
          </div>
        </Card>
      )}

      {created && (
        <Card>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gtn-green flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Import complete
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md bg-gtn-green-bg border border-gtn-green/30 p-3">
                <p className="text-2xl font-mono font-bold text-gtn-green">{created.created}</p>
                <p className="text-[10px] uppercase tracking-wide text-gtn-grey-2 mt-1">Created</p>
              </div>
              <div className="rounded-md bg-gtn-lavender border border-line-subtle p-3">
                <p className="text-2xl font-mono font-bold text-gtn-grey-2">{created.skippedDuplicate}</p>
                <p className="text-[10px] uppercase tracking-wide text-gtn-grey-2 mt-1">Duplicates skipped</p>
              </div>
              <div className="rounded-md bg-gtn-red/5 border border-gtn-red/30 p-3">
                <p className="text-2xl font-mono font-bold text-gtn-red">{created.errors}</p>
                <p className="text-[10px] uppercase tracking-wide text-gtn-grey-2 mt-1">Errors</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href="/leads">View leads →</Link>
              </Button>
            </div>
            {created.results.filter((r) => r.status === "error").length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gtn-red font-semibold">
                  {created.results.filter((r) => r.status === "error").length} row(s) had errors
                </summary>
                <ul className="mt-2 space-y-1">
                  {created.results
                    .filter((r) => r.status === "error")
                    .slice(0, 50)
                    .map((r) => (
                      <li key={r.rowIndex} className="text-ink-muted">
                        Row {r.rowIndex} ({r.raw.businessName ?? "—"}): {r.errors.join("; ")}
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
