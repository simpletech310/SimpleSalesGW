"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * v3.0 — Toolbar primitives used above DataTables on ListPage.
 *
 * Layout: a single horizontal strip with optional search input on the
 * left and arbitrary trailing actions/filters on the right. Wraps
 * gracefully on small screens.
 */
export function Toolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row md:items-center gap-3 md:gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarGroup({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-wrap",
        align === "right" && "md:ml-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}

type SearchInputProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  name?: string;
  className?: string;
  /** Bigger on mobile, ~280px on desktop */
  widthClass?: string;
};

export function SearchInput({
  value,
  defaultValue,
  onChange,
  placeholder = "Search",
  name = "q",
  className,
  widthClass = "w-full md:w-72",
}: SearchInputProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  function update(next: string) {
    if (!controlled) setInternal(next);
    onChange?.(next);
  }

  return (
    <div className={cn("relative", widthClass, className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint pointer-events-none" />
      <input
        type="search"
        name={name}
        value={current}
        onChange={(e) => update(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-9 w-full rounded-md border border-line bg-surface pl-8 pr-8 text-sm text-ink-strong",
          "placeholder:text-ink-faint",
          "hover:border-line-strong",
          "focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15",
          "transition-colors duration-120 ease-smooth",
        )}
      />
      {current && (
        <button
          type="button"
          onClick={() => update("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded text-ink-muted hover:text-ink-strong hover:bg-surface-3"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** A row of pill toggles for filter chips */
type ChipsProps<T extends string> = {
  options: ReadonlyArray<{ value: T; label: string; count?: number }>;
  value: T | null;
  onChange: (v: T | null) => void;
  /** Show an "All" option to clear the filter */
  allLabel?: string | null;
  className?: string;
};

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  allLabel = "All",
  className,
}: ChipsProps<T>) {
  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {allLabel !== null && (
        <ChipButton active={value === null} onClick={() => onChange(null)}>
          {allLabel}
        </ChipButton>
      )}
      {options.map((opt) => (
        <ChipButton
          key={opt.value}
          active={value === opt.value}
          onClick={() => onChange(value === opt.value ? null : opt.value)}
        >
          {opt.label}
          {typeof opt.count === "number" && (
            <span className="ml-1 text-ink-faint tabular">{opt.count}</span>
          )}
        </ChipButton>
      ))}
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tap-target
      className={cn(
        "inline-flex items-center h-8 px-3 rounded-full text-xs font-medium",
        "transition-colors duration-120 ease-smooth",
        active
          ? "bg-gtn-navy text-white border border-gtn-navy"
          : "bg-surface text-ink border border-line hover:bg-surface-3 hover:text-ink-strong",
      )}
    >
      {children}
    </button>
  );
}
