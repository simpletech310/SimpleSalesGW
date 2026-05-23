"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import type { Question } from "@/lib/assessment/questions";
import { STRINGS } from "@/lib/strings";

type Props = {
  assessmentId: string;
  leadName: string;
  leadHref: string;
  questions: ReadonlyArray<Question>;
  initialAnswers: Record<string, unknown>;
  /** "internal" = authenticated salesperson; "respondent" = public token-validated flow */
  mode?: "internal" | "respondent";
  /** Required when mode === "respondent" — used to build endpoint URLs */
  token?: string;
  /** Where to navigate on submit success */
  onSubmitRedirect?: string;
};

export function AssessmentRunner({
  assessmentId,
  leadName,
  leadHref,
  questions,
  initialAnswers,
  mode = "internal",
  token,
  onSubmitRedirect,
}: Props) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [submitting, setSubmitting] = useState(false);
  const total = questions.length;
  const q = questions[idx]!;
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const value = answers[q.id];
  const canNext = useMemo(() => {
    if (!q.required) return true;
    const v = answers[q.id];
    if (v === undefined || v === null || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === "object" && v !== null) {
      const obj = v as Record<string, unknown>;
      if ("value" in obj && obj.value === undefined) return false;
    }
    return true;
  }, [answers, q]);

  const answerUrl =
    mode === "respondent" && token
      ? `/api/assessments/respond/${token}/answer`
      : `/api/assessments/${assessmentId}/answer`;
  const submitUrl =
    mode === "respondent" && token
      ? `/api/assessments/respond/${token}/submit`
      : `/api/assessments/${assessmentId}/submit`;

  function setAnswer(id: string, val: unknown) {
    setAnswers((cur) => ({ ...cur, [id]: val }));
    // Debounced autosave
    clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(async () => {
      try {
        await fetch(answerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: id, answerValue: val }),
        });
      } catch {
        /* swallow; will retry on next change */
      }
    }, 500);
  }

  useEffect(() => () => {
    Object.values(saveTimers.current).forEach((t) => clearTimeout(t));
  }, []);

  async function flushAndAdvance(direction: -1 | 0 | 1) {
    // ensure current answer is flushed
    if (saveTimers.current[q.id]) {
      clearTimeout(saveTimers.current[q.id]);
      try {
        await fetch(answerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: q.id, answerValue: answers[q.id] ?? null }),
        });
      } catch { /* ignore */ }
    }
    setIdx((i) => Math.min(Math.max(i + direction, 0), total - 1));
  }

  async function submit() {
    setSubmitting(true);
    try {
      // ensure latest is flushed
      await flushAndAdvance(0);
      const res = await fetch(submitUrl, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Submission failed");
        return;
      }
      toast.success("Assessment complete");
      router.push(onSubmitRedirect ?? `/assessment/${assessmentId}/result`);
    } finally {
      setSubmitting(false);
    }
  }

  const progressPct = ((idx + 1) / total) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <Link href={leadHref} className="text-sm text-gtn-purple underline">
          ← {leadName}
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-gtn-grey-2 mb-1">
          <span>Section {q.section}</span>
          <span>{STRINGS.assessment.progress(idx + 1, total)}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gtn-lavender overflow-hidden">
          <div className="h-full bg-gtn-purple" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="gtn-card p-6">
        <p className="text-xs text-gtn-grey-3 font-mono uppercase">{q.id}</p>
        <h2 className="text-xl font-semibold text-gtn-navy mt-1">{q.prompt}</h2>
        {q.helpText && <p className="text-sm text-gtn-grey-2 mt-2">{q.helpText}</p>}

        <div className="mt-5">
          <AnswerInput question={q} value={value} onChange={(v) => setAnswer(q.id, v)} />
        </div>
      </div>

      <div className="mt-6 flex justify-between gap-3">
        <Button variant="secondary" disabled={idx === 0} onClick={() => flushAndAdvance(-1)}>
          ← {STRINGS.assessment.back}
        </Button>
        {idx < total - 1 ? (
          <Button disabled={!canNext} onClick={() => flushAndAdvance(1)}>
            {STRINGS.assessment.next} →
          </Button>
        ) : (
          <Button disabled={!canNext || submitting} onClick={submit}>
            {submitting ? "Scoring…" : STRINGS.assessment.submit}
          </Button>
        )}
      </div>
    </div>
  );
}

function AnswerInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (question.type) {
    case "single_select":
      return (
        <div className="space-y-2">
          {question.options?.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition ${
                value === opt.value
                  ? "border-gtn-purple bg-gtn-lavender"
                  : "border-gtn-lavender-2 hover:border-gtn-purple-3"
              }`}
            >
              <input
                type="radio"
                name={question.id}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                className="accent-gtn-purple"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      );

    case "multi_select": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2">
          {question.options?.map((opt) => {
            const isOn = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition ${
                  isOn
                    ? "border-gtn-purple bg-gtn-lavender"
                    : "border-gtn-lavender-2 hover:border-gtn-purple-3"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() =>
                    onChange(isOn ? selected.filter((s) => s !== opt.value) : [...selected, opt.value])
                  }
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
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`flex-1 py-3 rounded-md border ${value === true ? "bg-gtn-navy text-white border-gtn-navy" : "border-gtn-lavender-2"}`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`flex-1 py-3 rounded-md border ${value === false ? "bg-gtn-navy text-white border-gtn-navy" : "border-gtn-lavender-2"}`}
          >
            No
          </button>
        </div>
      );

    case "boolean_with_text": {
      const obj = (typeof value === "object" && value !== null ? value : { value: undefined, text: "" }) as { value?: boolean; text?: string };
      return (
        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onChange({ ...obj, value: true })}
              className={`flex-1 py-3 rounded-md border ${obj.value === true ? "bg-gtn-navy text-white border-gtn-navy" : "border-gtn-lavender-2"}`}
            >Yes</button>
            <button
              type="button"
              onClick={() => onChange({ ...obj, value: false })}
              className={`flex-1 py-3 rounded-md border ${obj.value === false ? "bg-gtn-navy text-white border-gtn-navy" : "border-gtn-lavender-2"}`}
            >No</button>
          </div>
          {obj.value === true && (
            <Textarea
              value={obj.text ?? ""}
              onChange={(e) => onChange({ ...obj, text: e.target.value })}
              placeholder="Details…"
            />
          )}
        </div>
      );
    }

    case "boolean_with_date": {
      const obj = (typeof value === "object" && value !== null ? value : { value: undefined, date: "" }) as { value?: boolean; date?: string };
      return (
        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onChange({ ...obj, value: true })}
              className={`flex-1 py-3 rounded-md border ${obj.value === true ? "bg-gtn-navy text-white border-gtn-navy" : "border-gtn-lavender-2"}`}
            >Yes</button>
            <button
              type="button"
              onClick={() => onChange({ ...obj, value: false })}
              className={`flex-1 py-3 rounded-md border ${obj.value === false ? "bg-gtn-navy text-white border-gtn-navy" : "border-gtn-lavender-2"}`}
            >No</button>
          </div>
          {obj.value === true && (
            <div className="space-y-2">
              <Label>Renewal date</Label>
              <Input
                type="date"
                value={obj.date ?? ""}
                onChange={(e) => onChange({ ...obj, date: e.target.value })}
              />
            </div>
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
      return (
        <Input type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      );

    case "text":
      return (
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
        />
      );
  }
}
