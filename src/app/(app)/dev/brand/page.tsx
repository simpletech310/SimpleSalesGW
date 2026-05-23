import { Shield, Server, Monitor, Activity, Sparkles } from "lucide-react";
import {
  BrandedFooter,
  Callout,
  HeroBand,
  IconTile,
  LetteredSubstep,
  MetaBlock,
  NumberedStep,
  PageHeaderBand,
  Pill,
} from "@/components/brand";
import { Card } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";
import { Button } from "@/components/ui/Button";

/**
 * /dev/brand — internal QA route showing every Gateway brand component in
 * one scrollable surface. Compare side-by-side with the Security Agent
 * Deployment SOP PDF to verify visual parity.
 *
 * This route stays in production for now — it's small, helpful for new
 * teammates auditing the brand, and isolated under /dev.
 */
export default function BrandDemoPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Hero band */}
      <HeroBand
        eyebrow="STANDARD OPERATING PROCEDURE"
        title="Brand component library"
        subtitle="Every Gateway brand primitive in one scrollable page. Visually match this against the SOP PDFs to confirm parity."
        actions={
          <>
            <Button variant="secondary">View on dark</Button>
            <Button>Open audit</Button>
          </>
        }
      >
        <div className="grid grid-cols-4 gap-3 max-w-md">
          <IconTile Icon={Shield} size="lg" />
          <IconTile Icon={Server} size="lg" />
          <IconTile Icon={Monitor} size="lg" />
          <IconTile Icon={Activity} size="lg" />
        </div>
      </HeroBand>

      {/* Page header band */}
      <section>
        <p className="gtn-eyebrow gtn-eyebrow--dark mb-2">Page header band</p>
        <PageHeaderBand pageTitle="Security Agent Deployment SOP" />
      </section>

      {/* Meta blocks */}
      <section>
        <p className="gtn-eyebrow gtn-eyebrow--dark mb-3">Meta blocks</p>
        <div className="grid sm:grid-cols-4 gap-4">
          <MetaBlock label="Department" value="Technical" />
          <MetaBlock label="Trigger" value="Tobin Security Request" />
          <MetaBlock label="Platform" value="Continuum / 247.net" />
          <MetaBlock label="Version" value="1.0 — 2026" />
        </div>
      </section>

      {/* Pills */}
      <section>
        <p className="gtn-eyebrow gtn-eyebrow--dark mb-3">Pills</p>
        <div className="flex flex-wrap gap-2">
          <Pill dot tone="navy">Gateway TelNet internal use only</Pill>
          <Pill dot tone="purple">Cybersecurity operations</Pill>
          <Pill tone="green">Active</Pill>
          <Pill tone="amber">Pending</Pill>
          <Pill tone="red">Blocked</Pill>
        </div>
      </section>

      {/* Callouts */}
      <section>
        <p className="gtn-eyebrow gtn-eyebrow--dark mb-3">Callouts</p>
        <div className="space-y-3">
          <Callout kind="tip">
            Reference the device name and ticket number in the email. Update the ticket status to <strong>Resolved</strong> after the notification is sent.
          </Callout>
          <Callout kind="important">
            Complete and accurate ConnectWise notes are required for every ticket. They serve as the official record of work performed.
          </Callout>
          <Callout kind="note">
            Skip steps that don&apos;t apply to this customer&apos;s bundle.
          </Callout>
          <Callout kind="warning">
            Below-floor pricing forces a COO approval regardless of discount percent.
          </Callout>
        </div>
      </section>

      {/* Numbered + lettered steps */}
      <section>
        <p className="gtn-eyebrow gtn-eyebrow--dark mb-3">Numbered + lettered steps</p>
        <Card className="space-y-5">
          <NumberedStep n={6} title="Notify the client of completion">
            Once both agents are confirmed active in their portals, send a completion email to the client confirming that the agents have been successfully installed.
            <div className="mt-3">
              <Callout kind="tip">
                Reference the device name and ticket number in the email.
              </Callout>
            </div>
          </NumberedStep>

          <NumberedStep n={7} title="Document work in ConnectWise">
            Round out the SOP by entering thorough notes into the ConnectWise ticket.
            <div className="mt-3 space-y-2">
              <LetteredSubstep letter="A" title="Device details">
                record the hostname, client/site name, and confirmation that this was the correct target device.
              </LetteredSubstep>
              <LetteredSubstep letter="B" title="Installation summary">
                note that both agents were deployed via the Tobin Lux scripts in Continuum with default settings.
              </LetteredSubstep>
              <LetteredSubstep letter="C" title="Verification">
                confirm both portals show the device as active and enrolled.
              </LetteredSubstep>
              <LetteredSubstep letter="D" title="Client notification">
                note that the completion email was sent and reference any client reply.
              </LetteredSubstep>
            </div>
          </NumberedStep>
        </Card>
      </section>

      {/* Tooltip */}
      <section>
        <p className="gtn-eyebrow gtn-eyebrow--dark mb-3">Tooltip</p>
        <div className="flex items-center gap-3">
          <Tooltip content="Hover help — used for FieldHelp + GlossaryTerm.">
            <Button variant="ghost" size="sm">
              <Sparkles size={14} className="mr-2" /> Hover me
            </Button>
          </Tooltip>
        </div>
      </section>

      {/* Footer */}
      <section>
        <p className="gtn-eyebrow gtn-eyebrow--dark mb-3">Footer band</p>
        <BrandedFooter />
      </section>
    </div>
  );
}
