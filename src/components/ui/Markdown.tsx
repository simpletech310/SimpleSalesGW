/**
 * v3.3.29 — Constrained markdown renderer for AI research output.
 *
 * The agentic research loop produces briefings with light markdown
 * (**bold**, *italic*, `code`, [link](url), bullet lists). We render
 * those with react-markdown wired to:
 *   - GFM (strikethrough, tables, autolinks — `remark-gfm`)
 *   - Explicit allowed-elements list (no images, no raw HTML, no
 *     headings — keeps the visual footprint controlled)
 *   - Project utility classes (gtn-purple links, gtn-navy text)
 *
 * react-markdown blocks raw HTML by default, so XSS surface here is
 * just whatever react-markdown's parser handles — battle-tested.
 *
 * Two variants:
 *   - <Markdown> for prose paragraphs (summary, news summary).
 *   - <MarkdownInline> for one-line bullets — strips block elements
 *     so the rendered output stays on one line inside a <li>.
 */

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Default `<a>` renderer — opens in a new tab + safe rel. */
function MdLink({
  href,
  children,
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  if (!href) return <>{children}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-gtn-purple hover:underline break-words"
    >
      {children}
    </a>
  );
}

const ALLOWED_ELEMENTS = [
  "p",
  "br",
  "strong",
  "em",
  "del",
  "code",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
];

const INLINE_ALLOWED_ELEMENTS = [
  // For per-bullet use — drop block wrappers so the markdown collapses
  // into a single line within an existing <li>.
  "strong",
  "em",
  "del",
  "code",
  "a",
];

type Variant = "prose" | "compact" | "inline";

const variantClass: Record<Variant, string> = {
  // Full prose — paragraphs get spacing, lists indent.
  prose:
    "text-sm text-gtn-navy whitespace-pre-wrap leading-relaxed " +
    "[&_p]:mb-2 [&_p:last-child]:mb-0 " +
    "[&_strong]:font-semibold [&_strong]:text-gtn-navy " +
    "[&_em]:italic " +
    "[&_code]:font-mono [&_code]:text-[0.85em] [&_code]:bg-gtn-lavender [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded " +
    "[&_ul]:list-disc [&_ul]:ml-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:my-1 " +
    "[&_li]:my-0.5 " +
    "[&_blockquote]:border-l-2 [&_blockquote]:border-gtn-lavender-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gtn-grey-2",
  // Compact prose — tighter line height, no inter-paragraph margin.
  compact:
    "text-sm text-gtn-navy " +
    "[&_p]:mb-1 [&_p:last-child]:mb-0 " +
    "[&_strong]:font-semibold " +
    "[&_em]:italic " +
    "[&_code]:font-mono [&_code]:text-[0.85em] [&_code]:bg-gtn-lavender [&_code]:px-1 [&_code]:rounded",
  // Inline — strip block wrappers entirely (used inside an existing <li>).
  inline:
    "text-sm text-gtn-navy " +
    "[&_strong]:font-semibold " +
    "[&_em]:italic " +
    "[&_code]:font-mono [&_code]:text-[0.85em] [&_code]:bg-gtn-lavender [&_code]:px-1 [&_code]:rounded",
};

export function Markdown({
  children,
  variant = "prose",
  className,
}: {
  children: string | null | undefined;
  variant?: Variant;
  className?: string;
}) {
  if (!children || !children.trim()) return null;
  const allowed = variant === "inline" ? INLINE_ALLOWED_ELEMENTS : ALLOWED_ELEMENTS;
  return (
    <div className={cn(variantClass[variant], className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={allowed}
        unwrapDisallowed
        // Force links to use our safe renderer
        components={{ a: MdLink }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Convenience: inline-only markdown for use inside `<li>` or other
 * existing block wrappers. Strips paragraph + list wrappers so the
 * output flows on a single line.
 */
export function MarkdownInline({
  children,
  className,
}: {
  children: string | null | undefined;
  className?: string;
}) {
  return (
    <Markdown variant="inline" className={cn("inline", className)}>
      {children}
    </Markdown>
  );
}
