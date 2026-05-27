"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SiteSurveyClientType, SiteSurveyStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

type SiteSurvey = {
  id: string;
  leadId: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  pocName: string;
  pocTitle: string;
  pocEmail: string;
  pocPhone: string;
  pocCanAuthorize: boolean;
  clientType: SiteSurveyClientType;
  status: SiteSurveyStatus;
  notesForVcio: string | null;
  vcioUserId: string | null;
  vcioAcceptedAt: string | null;
  vcioRejectedAt: string | null;
  vcioRejectReason: string | null;
  discoveryVerifiedAt: string | null;
  verifiedSeatCount: number | null;
  verifiedSiteCount: number | null;
};

const CLIENT_TYPE_LABEL: Record<SiteSurveyClientType, string> = {
  IT: "IT (managed services)",
  ACCESS_CONTROL: "Access Control",
  CCTV: "CCTV / Video Surveillance",
  MIXED: "Mixed (multiple service lines)",
};

const STATUS_LABEL: Record<SiteSurveyStatus, string> = {
  DRAFT: "Draft",
  AWAITING_VCIO_ACCEPT: "Awaiting vCIO acceptance",
  ACCEPTED: "Accepted by vCIO",
  REJECTED: "Rejected by vCIO",
  COMPLETED: "Completed",
};

const STATUS_TONE: Record<SiteSurveyStatus, string> = {
  DRAFT:                "bg-gtn-lavender text-gtn-navy",
  AWAITING_VCIO_ACCEPT: "bg-amber-100 text-amber-900",
  ACCEPTED:             "bg-emerald-100 text-emerald-900",
  REJECTED:             "bg-red-100 text-red-900",
  COMPLETED:            "bg-blue-100 text-blue-900",
};

export function SiteSurveyPanel({
  leadId,
  canEdit,
  canAccept,
  defaultClientType,
}: {
  leadId: string;
  canEdit: boolean;
  canAccept: boolean;
  defaultClientType?: SiteSurveyClientType;
}) {
  const router = useRouter();
  const [survey, setSurvey] = useState<SiteSurvey | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/leads/${leadId}/site-survey`);
        const data = await res.json();
        if (!cancelled) setSurvey(data.siteSurvey ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  if (loading) return <p className="text-sm text-gtn-grey-2">Loading site survey…</p>;

  return (
    <div className="space-y-4">
      {survey ? (
        <ExistingSurvey
          survey={survey}
          canEdit={canEdit}
          canAccept={canAccept}
          busy={busy}
          setBusy={setBusy}
          onUpdate={(s) => { setSurvey(s); router.refresh(); }}
        />
      ) : (
        <SurveyForm
          leadId={leadId}
          canEdit={canEdit}
          defaultClientType={defaultClientType}
          busy={busy}
          setBusy={setBusy}
          onCreate={(s) => { setSurvey(s); router.refresh(); }}
        />
      )}
    </div>
  );
}

function SurveyForm({
  leadId,
  canEdit,
  defaultClientType,
  busy,
  setBusy,
  onCreate,
}: {
  leadId: string;
  canEdit: boolean;
  defaultClientType?: SiteSurveyClientType;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onCreate: (s: SiteSurvey) => void;
}) {
  const [form, setForm] = useState({
    scheduledDate: "",
    scheduledStart: "09:00",
    scheduledEnd: "11:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    pocName: "",
    pocTitle: "",
    pocEmail: "",
    pocPhone: "",
    pocCanAuthorize: false,
    clientType: (defaultClientType ?? "IT") as SiteSurveyClientType,
    notesForVcio: "",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/site-survey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't schedule the site survey");
      toast.success("Site survey submitted — vCIO has been notified.");
      onCreate(data.siteSurvey);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-gtn-navy">Schedule the site survey</h3>
        <p className="text-xs text-gtn-grey-2">
          Capture the on-site point of contact, confirm they can authorize decisions, lock the date/time, and tag the
          service line. The vCIO won&apos;t accept until all of this is in place.
        </p>
      </div>
      <form onSubmit={submit} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Assessment date</Label>
          <Input type="date" required value={form.scheduledDate} onChange={(e) => set("scheduledDate", e.target.value)} />
        </div>
        <div>
          <Label>Timezone</Label>
          <Input value={form.timezone} onChange={(e) => set("timezone", e.target.value)} />
        </div>
        <div>
          <Label>Start time</Label>
          <Input type="time" required value={form.scheduledStart} onChange={(e) => set("scheduledStart", e.target.value)} />
        </div>
        <div>
          <Label>End time</Label>
          <Input type="time" required value={form.scheduledEnd} onChange={(e) => set("scheduledEnd", e.target.value)} />
        </div>

        <div className="md:col-span-2 pt-2 border-t border-gtn-lavender-2 mt-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gtn-grey-2 mb-2">On-site POC (decision maker)</p>
        </div>
        <div>
          <Label>POC name</Label>
          <Input required value={form.pocName} onChange={(e) => set("pocName", e.target.value)} />
        </div>
        <div>
          <Label>POC title</Label>
          <Input required value={form.pocTitle} onChange={(e) => set("pocTitle", e.target.value)} />
        </div>
        <div>
          <Label>POC email</Label>
          <Input type="email" required value={form.pocEmail} onChange={(e) => set("pocEmail", e.target.value)} />
        </div>
        <div>
          <Label>POC phone</Label>
          <Input required value={form.pocPhone} onChange={(e) => set("pocPhone", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="flex items-start gap-2 text-sm text-gtn-navy">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.pocCanAuthorize}
              onChange={(e) => set("pocCanAuthorize", e.target.checked)}
            />
            <span>I&apos;ve confirmed this POC can authorize purchase decisions on behalf of the business.</span>
          </label>
        </div>

        <div className="md:col-span-2 pt-2 border-t border-gtn-lavender-2 mt-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gtn-grey-2 mb-2">Service scope</p>
        </div>
        <div className="md:col-span-2">
          <Label>Client type</Label>
          <select
            className="w-full border border-gtn-lavender-2 rounded-md px-3 py-2 text-sm bg-white"
            value={form.clientType}
            onChange={(e) => set("clientType", e.target.value as SiteSurveyClientType)}
          >
            {(Object.keys(CLIENT_TYPE_LABEL) as SiteSurveyClientType[]).map((k) => (
              <option key={k} value={k}>{CLIENT_TYPE_LABEL[k]}</option>
            ))}
          </select>
          <p className="text-[11px] text-gtn-grey-2 mt-1">Drives which template and vCIO specialty matches this assessment.</p>
        </div>
        <div className="md:col-span-2">
          <Label>Notes for the vCIO (optional)</Label>
          <Textarea
            rows={3}
            placeholder="What the rep already learned: stated pain, decision timeline, who else is in the room, anything Lin should know before walking in…"
            value={form.notesForVcio}
            onChange={(e) => set("notesForVcio", e.target.value)}
          />
        </div>

        <div className="md:col-span-2 mt-2 flex justify-end">
          <Button type="submit" disabled={!canEdit || busy}>
            {busy ? "Submitting…" : "Submit to vCIO"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ExistingSurvey({
  survey,
  canEdit,
  canAccept,
  busy,
  setBusy,
  onUpdate,
}: {
  survey: SiteSurvey;
  canEdit: boolean;
  canAccept: boolean;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onUpdate: (s: SiteSurvey) => void;
}) {
  async function accept() {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${survey.leadId}/site-survey/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Accept failed");
      toast.success("Site survey accepted.");
      onUpdate(data.siteSurvey);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    const reason = window.prompt("Why are you rejecting? (rep will see this)");
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${survey.leadId}/site-survey/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Reject failed");
      toast.success("Site survey rejected — rep notified.");
      onUpdate(data.siteSurvey);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    const seatsStr = window.prompt("Verified seat count from on-site walk-through?");
    if (!seatsStr) return;
    const sitesStr = window.prompt("Verified site count?");
    if (!sitesStr) return;
    const seats = Number(seatsStr);
    const sites = Number(sitesStr);
    if (!Number.isFinite(seats) || !Number.isFinite(sites)) {
      toast.error("Need numeric values for seats + sites.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${survey.leadId}/site-survey/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifiedSeatCount: seats, verifiedSiteCount: sites }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Verify failed");
      toast.success("Discovery verified — lead can advance to Quote in Progress.");
      onUpdate(data.siteSurvey);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gtn-navy">Site survey</h3>
          <p className="text-xs text-gtn-grey-2">{CLIENT_TYPE_LABEL[survey.clientType]}</p>
        </div>
        <span className={`px-2 py-1 rounded text-[11px] font-semibold ${STATUS_TONE[survey.status]}`}>
          {STATUS_LABEL[survey.status]}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gtn-grey-2">Scheduled</dt>
          <dd className="text-gtn-navy">
            {new Date(survey.scheduledDate).toLocaleDateString()} · {survey.scheduledStart}–{survey.scheduledEnd} · {survey.timezone}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gtn-grey-2">POC</dt>
          <dd className="text-gtn-navy">
            {survey.pocName} — {survey.pocTitle}
            <br />
            <span className="text-xs text-gtn-grey-2">{survey.pocEmail} · {survey.pocPhone}</span>
            {survey.pocCanAuthorize ? null : (
              <span className="block text-xs text-red-700 mt-1">POC authority not confirmed.</span>
            )}
          </dd>
        </div>
        {survey.notesForVcio && (
          <div className="md:col-span-2">
            <dt className="text-[11px] uppercase tracking-wide text-gtn-grey-2">Notes for vCIO</dt>
            <dd className="text-gtn-navy whitespace-pre-wrap">{survey.notesForVcio}</dd>
          </div>
        )}
        {survey.vcioRejectReason && (
          <div className="md:col-span-2">
            <dt className="text-[11px] uppercase tracking-wide text-red-700">Rejected — reason</dt>
            <dd className="text-red-900 whitespace-pre-wrap">{survey.vcioRejectReason}</dd>
          </div>
        )}
        {survey.discoveryVerifiedAt && (
          <div className="md:col-span-2 mt-2 p-3 rounded bg-emerald-50 border border-emerald-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Discovery verified</p>
            <p className="text-sm text-emerald-900 mt-1">
              vCIO confirmed {survey.verifiedSeatCount} seats across {survey.verifiedSiteCount} site(s) on{" "}
              {new Date(survey.discoveryVerifiedAt).toLocaleDateString()}.
            </p>
          </div>
        )}
      </dl>

      <div className="mt-5 flex flex-wrap gap-2 justify-end">
        {canAccept && survey.status === "AWAITING_VCIO_ACCEPT" && (
          <>
            <Button variant="secondary" disabled={busy} onClick={reject}>Reject</Button>
            <Button disabled={busy} onClick={accept}>Accept</Button>
          </>
        )}
        {canAccept && survey.status === "ACCEPTED" && (
          <Button disabled={busy} onClick={verify}>Verify discovery data</Button>
        )}
        {canEdit && survey.status === "REJECTED" && (
          <p className="text-xs text-gtn-grey-2 self-center">Update the lead&apos;s site survey and resubmit when the vCIO&apos;s concerns are addressed.</p>
        )}
      </div>
    </Card>
  );
}
