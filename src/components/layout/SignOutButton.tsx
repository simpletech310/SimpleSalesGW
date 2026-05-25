"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

/**
 * v3.1.5 — SignOut renders in two contexts:
 *   - "light" (default): the white sidebar identity block — labeled pill
 *     with ink-muted text + danger hover. Visible against bg-surface.
 *   - "dark": the navy mobile header — icon-only on translucent white.
 */
export function SignOutButton({ variant = "light" }: { variant?: "light" | "dark" }) {
  if (variant === "dark") {
    return (
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="p-2 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="h-5 w-5" aria-hidden />
      </button>
    );
  }
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={cn(
        "w-full inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-md text-xs font-medium transition-colors",
        "text-ink-muted hover:text-danger hover:bg-danger-soft/60",
        "border border-line-subtle hover:border-danger/30",
        "focus:outline-none focus:ring-2 focus:ring-danger/30",
      )}
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      Sign out
    </button>
  );
}
