"use client";

import type { ReactNode } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { findGlossaryEntry } from "@/lib/glossary";

/**
 * GlossaryTerm — wraps an inline acronym or jargon term and surfaces its
 * plain-English definition on hover. Looks up the definition from
 * src/lib/glossary.ts; if the term isn't registered, falls back to passthrough.
 *
 * Usage:
 *   <GlossaryTerm term="NIST CSF" />
 *   <GlossaryTerm term="MFA">MFA</GlossaryTerm>
 *   <GlossaryTerm term="below-floor pricing">below the floor</GlossaryTerm>
 */
export function GlossaryTerm({
  term,
  children,
}: {
  term: string;
  children?: ReactNode;
}) {
  const entry = findGlossaryEntry(term);
  const label = children ?? term;
  if (!entry) return <>{label}</>;

  return (
    <Tooltip content={<><strong className="text-white">{entry.term}</strong>{" — "}{entry.definition}</>} maxWidth={320}>
      <span
        className="border-b border-dotted border-gtn-purple cursor-help"
        tabIndex={0}
      >
        {label}
      </span>
    </Tooltip>
  );
}
