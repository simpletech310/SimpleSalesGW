import type { ReactNode } from "react";

/**
 * Branded TIP / IMPORTANT / NOTE / WARNING callout.
 *
 * Matches the lavender-background callout from the Gateway Security Agent
 * Deployment SOP interior pages: a small label pill on the left, content on
 * the right, left-purple border. Used throughout the help system + form
 * surfaces wherever a tip or warning is appropriate.
 */

export type CalloutKind = "tip" | "important" | "note" | "warning";

const KIND_CLASS: Record<CalloutKind, string> = {
  tip:       "",
  important: "",
  note:      "gtn-callout-v2--note",
  warning:   "gtn-callout-v2--warning",
};

const KIND_LABEL: Record<CalloutKind, string> = {
  tip:       "Tip",
  important: "Important",
  note:      "Note",
  warning:   "Warning",
};

export function Callout({
  kind = "tip",
  label,
  children,
  className,
}: {
  kind?: CalloutKind;
  /** Override the default label ("Tip" / "Important" etc.) */
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={`gtn-callout-v2 ${KIND_CLASS[kind]} ${className ?? ""}`}
      role="note"
    >
      <div className="gtn-callout-v2__label">{label ?? KIND_LABEL[kind]}</div>
      <div className="gtn-callout-v2__body">{children}</div>
    </aside>
  );
}
