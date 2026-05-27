"use client";

import { useEffect, useState } from "react";
import { DataBadgeRow, type DataProvenance } from "./DataBadge";

type Sections = {
  scopeMarkdown: string;
  deliverablesMarkdown: string;
  timelineMarkdown: string;
  exclusionsMarkdown: string;
  termsMarkdown: string;
};

/**
 * Live document preview — concatenates the 5 SOW sections with the same
 * letterhead and typography the customer-facing PDF uses. Sits next to
 * the SectionEditor stack so reviewers see formatted output as they edit.
 */
export function ProposalPreview({
  leadId,
  sections,
  businessName,
}: {
  leadId: string;
  sections: Sections;
  businessName?: string;
}) {
  const [provenance, setProvenance] = useState<DataProvenance[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [leadRes, surveyRes] = await Promise.all([
          fetch(`/api/leads/${leadId}`),
          fetch(`/api/leads/${leadId}/site-survey`),
        ]);
        const lead = leadRes.ok ? await leadRes.json() : null;
        const survey = surveyRes.ok ? await surveyRes.json() : null;
        const repSeats = lead?.lead?.seatCount ?? lead?.seatCount ?? null;
        const repSites = lead?.lead?.siteCount ?? lead?.siteCount ?? null;
        const verifiedSeats = survey?.siteSurvey?.verifiedSeatCount ?? null;
        const verifiedSites = survey?.siteSurvey?.verifiedSiteCount ?? null;
        if (cancelled) return;
        setProvenance([
          { label: "Seats", proposalValue: repSeats, verifiedValue: verifiedSeats },
          { label: "Sites", proposalValue: repSites, verifiedValue: verifiedSites },
        ]);
      } catch {
        /* tolerate */
      }
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  return (
    <aside className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl bg-white border border-line-subtle shadow-sm">
      <header className="px-5 py-3 border-b border-line-subtle bg-surface-2/40">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Live preview</p>
        <h3 className="text-base font-semibold text-ink-strong mt-0.5">Statement of Work</h3>
        {businessName && <p className="text-xs text-ink-muted">Prepared for {businessName}</p>}
      </header>
      <div className="px-5 py-3 border-b border-line-subtle bg-surface-2/20">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mb-1.5">Data provenance</p>
        <DataBadgeRow items={provenance} />
        <p className="text-[11px] text-ink-faint mt-2">
          Hover any badge for source detail. Red = rep-entered conflicts with discovery — fix before sending.
        </p>
      </div>
      <article className="prose-proposal px-6 py-6 space-y-6 leading-relaxed">
        <PreviewSection title="Scope" markdown={sections.scopeMarkdown} />
        <PreviewSection title="Deliverables" markdown={sections.deliverablesMarkdown} />
        <PreviewSection title="Timeline" markdown={sections.timelineMarkdown} />
        <PreviewSection title="Exclusions" markdown={sections.exclusionsMarkdown} />
        <PreviewSection title="Terms" markdown={sections.termsMarkdown} />
      </article>
    </aside>
  );
}

function PreviewSection({ title, markdown }: { title: string; markdown: string }) {
  return (
    <section>
      <h4 className="text-sm font-semibold text-gtn-navy uppercase tracking-wide mb-2">{title}</h4>
      {markdown.trim().length === 0 ? (
        <p className="text-xs italic text-ink-faint">(empty)</p>
      ) : (
        <div className="text-sm text-ink-strong whitespace-pre-wrap font-serif">{markdown}</div>
      )}
    </section>
  );
}
