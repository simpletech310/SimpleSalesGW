"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { fillTemplate, type OutreachTemplate } from "@/lib/outreach/templates";

type Tone = "warm" | "formal" | "follow_up";

type LeadLike = {
  id: string;
  businessName: string;
  industry: string;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
};

export function OutreachComposer({
  lead,
  templates,
  senderName,
}: {
  lead: LeadLike;
  templates: ReadonlyArray<OutreachTemplate>;
  senderName: string;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const template = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);

  const defaultVars: Record<string, string> = useMemo(() => ({
    first_name: lead.primaryContactName?.split(" ")[0] ?? "there",
    business_name: lead.businessName,
    industry: lead.industry.replace(/_/g, " ").toLowerCase(),
    sender_name: senderName,
  }), [lead, senderName]);

  const [vars, setVars] = useState<Record<string, string>>(defaultVars);
  const [to, setTo] = useState<string>(lead.primaryContactEmail ?? "");
  const [subject, setSubject] = useState<string>(() => fillTemplate(template?.subject ?? "", defaultVars));
  const [body, setBody] = useState<string>(() => fillTemplate(template?.body ?? "", defaultVars));
  const [sending, setSending] = useState(false);
  // v2.20 — AI personalize state
  const [personalizing, setPersonalizing] = useState(false);
  const [tone, setTone] = useState<Tone>("warm");
  const [aiNotes, setAiNotes] = useState<string>("");

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    setTemplateId(id);
    if (t) {
      setSubject(fillTemplate(t.subject, vars));
      setBody(fillTemplate(t.body, vars));
    }
  }

  function setVar(k: string, v: string) {
    const next = { ...vars, [k]: v };
    setVars(next);
    if (template) {
      setSubject(fillTemplate(template.subject, next));
      setBody(fillTemplate(template.body, next));
    }
  }

  async function personalize() {
    if (!templateId) {
      toast.error("Pick a template first.");
      return;
    }
    setPersonalizing(true);
    setAiNotes("");
    try {
      const res = await fetch(`/api/leads/${lead.id}/outreach/personalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, tone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Personalize failed");
        return;
      }
      setSubject(data.subject ?? subject);
      setBody(data.body ?? body);
      setAiNotes(data.notes ?? "");
      toast.success("Personalized — review before sending");
      // v2.20.3 — refresh server components so the AI usage meter updates
      router.refresh();
    } catch {
      toast.error("Personalize failed");
    } finally {
      setPersonalizing(false);
    }
  }

  async function send() {
    setSending(true);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, to, subject, body, templateId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed");
      } else {
        // v2.14 — surface the email-not-actually-sent fallback as a warning
        // toast, not a green success. The API returns `sent: false` when
        // RESEND_API_KEY isn't configured (the message body is logged as an
        // Activity instead). Without this branch the user thinks the email
        // went out when it didn't.
        if (data.sent === false) {
          toast.warning(data.message ?? "Logged as activity — email not configured.", {
            duration: 6000,
          });
        } else {
          toast.success(data.message ?? "Sent.");
        }
        router.push(`/leads/${lead.id}`);
      }
    } finally {
      setSending(false);
    }
  }

  const placeholders = template?.placeholders ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <Label htmlFor="tpl">Template</Label>
        <select
          id="tpl"
          value={templateId}
          onChange={(e) => applyTemplate(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm mt-2"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name} · {t.category}</option>
          ))}
        </select>

        {/* v2.20 — AI personalize controls */}
        <div className="mt-4 p-3 rounded-md border border-gtn-lavender-2 bg-gtn-lavender/30">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-gtn-purple flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Personalize with AI
              </p>
              <p className="text-[11px] text-gtn-grey-2 mt-0.5">
                Rewrites subject + body for this lead&apos;s industry, contact, and research context.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="tone" className="text-xs">Tone</Label>
              <select
                id="tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-8 rounded border border-input bg-white px-2 text-xs"
                disabled={personalizing}
              >
                <option value="warm">warm</option>
                <option value="formal">formal</option>
                <option value="follow_up">follow-up</option>
              </select>
              <Button size="sm" onClick={personalize} disabled={personalizing || !templateId}>
                {personalizing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Writing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Personalize
                  </>
                )}
              </Button>
            </div>
          </div>
          {aiNotes && (
            <p className="text-[11px] italic text-gtn-grey-2 mt-2 border-t border-gtn-lavender-2 pt-2">
              <strong>What changed:</strong> {aiNotes}
            </p>
          )}
        </div>

        {placeholders.length > 0 && (
          <div className="mt-4 grid md:grid-cols-2 gap-3">
            {placeholders.map((p) => (
              <div key={p} className="space-y-1">
                <Label className="text-xs uppercase tracking-wide">{p}</Label>
                <Input
                  value={vars[p] ?? ""}
                  onChange={(e) => setVar(p, e.target.value)}
                  placeholder={`{{${p}}}`}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="email" value={to} onChange={(e) => setTo(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Body</Label>
            <Textarea id="body" rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={send} disabled={!to || sending}>{sending ? "Sending…" : "Send"}</Button>
      </div>
    </div>
  );
}
