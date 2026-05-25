import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = {
  href?: string;
  label: string;
};

/**
 * v3.0 — slim breadcrumb used in the Topbar and DetailPage entity header.
 * First crumb is auto-prefixed with a Home icon when `home` is true.
 */
export function Breadcrumb({
  items,
  home = true,
  className,
}: {
  items: Crumb[];
  home?: boolean;
  className?: string;
}) {
  const list: Crumb[] = home ? [{ href: "/", label: "Home" }, ...items] : items;
  const last = list.length - 1;
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex items-center gap-1 text-sm text-ink-muted min-w-0">
        {list.map((c, i) => {
          const isLast = i === last;
          const content = (
            <span
              className={cn(
                "flex items-center gap-1.5 truncate",
                isLast ? "text-ink-strong font-medium" : "hover:text-ink-strong transition-colors",
              )}
            >
              {i === 0 && home && <Home className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />}
              <span className="truncate">{c.label}</span>
            </span>
          );
          return (
            <li key={`${c.label}-${i}`} className={cn("flex items-center gap-1 min-w-0", isLast && "min-w-0")}>
              {c.href && !isLast ? <Link href={c.href}>{content}</Link> : content}
              {!isLast && (
                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-ink-faint" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
