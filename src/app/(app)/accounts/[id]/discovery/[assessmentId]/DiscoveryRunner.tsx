"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { DiscoveryQuestion } from "@/lib/discovery/types";

type Props = {
  title: string;
  customerName: string;
  customerId: string;
  assessmentId: string;
  questions: ReadonlyArray<DiscoveryQuestion>;
  initialAnswers: Record<string, unknown>;
};

/**
 * Discovery runner — sectioned form (Site Survey / AI Readiness / NIST CSF).
 * Debounced autosave per answer; explicit "Complete" runs scoring server-side.
 */
export function DiscoveryRunner({ title, customerName, customerId, assessmentId, questions, initialAnswers }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [submitting, setSubmitting] = useState(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const sections = useMemo(() => {
    const seen = new Map<string, DiscoveryQuestion[]>();
    for (const q of questions) {
      if (!seen.has(q.section)) seen.set(q.section, []);
      seen.get(q.section)!.push(q);
    }
    return Array.from(seen.entries());
  }, [questions]);

  function setAnswer(id: string, val: unknown) {
    setAnswers((cur) => ({ ...cur, [id]: val }));
    clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(async () => {
      try {
        await fetch(`/api/accounts/${customerId}/discovery/${assessmentId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: id, answerValue: val }),
        });
      } catch { /* ignore — retry on next change */ }
    }, 500);
  }

  useEffect(() => () => {
    Object.values(saveTimers.current).forEach((t) => clearTimeout(t));
  }, []);

  async function flush(): Promise<void> {
    // Best-effort: fire any pending saves
    const pending = Object.entries(saveTimers.current);
    for (const [, t] of pending) clearTimeout(t);
    saveTimers.current = {};
  }

  function unfilledRequired(): string[] {
    return questions
      .filter((q) => q.required)
      .filter((q) => {
        const v = answers[q.id];
        if (v === undefined || v === null || v === "") return true;
        if (Array.isArray(v) && v.length === 0) return true;
        return false;
      })
      .map((q) => q.id);
  }

  async function complete() {
    const missing = unfilledRequired();
    if (missing.length > 0) {
      toast.error(`Missing ${missing.length} required answer${missing.length === 1 ? "" : "s"}: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}`);
      return;
    }
    setSubmitting(true);
    await flush();
    try {
      const res = await fetch(`/api/accounts/${customerId}/discovery/${assessmentId}/complete`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to complete");
        return;
      }
      toast.success("Discovery scored");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link className="text-sm text-gtn-purple underline" href={`/accounts/${customerId}`}>← {customerName}</Link>
        <h1 className="text-2xl font-bold text-gtn-navy mt-2">{title}</h1>
        <p className="text-sm text-gtn-grey-2">Save as you go. Click <strong>Complete</strong> to generate the scorecard.</p>
      </div>

      {sections.map(([sectionName, sectionQuestions]) => (
        <Card key={sectionName}>
          <h2 className="text-sm font-semibold text-gtn-navy mb-3">{sectionName}</h2>
          <div className="space-y-4">
            {sectionQuestions.map((q) => (
              <QuestionField
                key={q.id}
                question={q}
                value={answers[q.id]}
                onChange={(v) => setAnswer(q.id, v)}
              />
            ))}
          </div>
        </Card>
      ))}

      <div className="flex justify-end gap-2 sticky bottom-4">
        <Button size="lg" disabled={submitting} onClick={complete}>
          {submitting ? "Scoring…" : "Complete + score"}
        </Button>
      </div>
    </div>
  );
}

function QuestionField({ question, value, onChange }: { question: DiscoveryQuestion; value: unknown; onChange: (v: unknown) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-mono text-gtn-grey-3">{question.id}</Label>
      <p className="text-sm font-medium text-gtn-navy">
        {question.prompt}
        {question.required && <span className="text-gtn-red ml-1">*</span>}
      </p>
      {question.helpText && <p className="text-xs text-gtn-grey-2">{question.helpText}</p>}
      <AnswerInput question={question} value={value} onChange={onChange} />
    </div>
  );
}

function AnswerInput({ question, value, onChange }: { question: DiscoveryQuestion; value: unknown; onChange: (v: unknown) => void }) {
  switch (question.type) {
    case "single_select":
      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
        >
          <option value="">— select —</option>
          {question.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );

    case "multi_select": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="grid sm:grid-cols-2 gap-2">
          {question.options?.map((opt) => {
            const on = selected.includes(opt.value);
            return (
              <label key={opt.value} className={`flex items-center gap-2 p-2 rounded border ${on ? "border-gtn-purple bg-gtn-lavender" : "border-gtn-lavender-2"}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onChange(on ? selected.filter((s) => s !== opt.value) : [...selected, opt.value])}
                  className="accent-gtn-purple"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case "boolean":
      return (
        <div className="flex gap-2">
          <button type="button" onClick={() => onChange(true)} className={`flex-1 py-2 rounded border text-sm ${value === true ? "bg-gtn-navy text-white border-gtn-navy" : "border-gtn-lavender-2"}`}>Yes</button>
          <button type="button" onClick={() => onChange(false)} className={`flex-1 py-2 rounded border text-sm ${value === false ? "bg-gtn-navy text-white border-gtn-navy" : "border-gtn-lavender-2"}`}>No</button>
        </div>
      );

    case "boolean_with_text": {
      const obj = (typeof value === "object" && value !== null ? value : { value: undefined, text: "" }) as { value?: boolean; text?: string };
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button type="button" onClick={() => onChange({ ...obj, value: true })} className={`flex-1 py-2 rounded border text-sm ${obj.value === true ? "bg-gtn-navy text-white border-gtn-navy" : "border-gtn-lavender-2"}`}>Yes</button>
            <button type="button" onClick={() => onChange({ ...obj, value: false })} className={`flex-1 py-2 rounded border text-sm ${obj.value === false ? "bg-gtn-navy text-white border-gtn-navy" : "border-gtn-lavender-2"}`}>No</button>
          </div>
          {obj.value === true && (
            <Textarea value={obj.text ?? ""} onChange={(e) => onChange({ ...obj, text: e.target.value })} placeholder="Details…" rows={2} />
          )}
        </div>
      );
    }

    case "numeric":
      return (
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={(value as number | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );

    case "date":
      return <Input type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;

    case "text":
      return <Textarea value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />;
  }
}
