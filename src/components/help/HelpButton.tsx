"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Floating Help button — appears in the bottom-right of every authenticated
 * page. Click takes you to /help, where you can re-read your role's
 * walkthrough or scan the glossary.
 */
export function HelpButton() {
  return (
    <Tooltip content="Open the help center" side="left">
      <Link
        href="/help"
        aria-label="Open help center"
        className="fixed bottom-20 right-4 z-40 inline-flex items-center justify-center w-12 h-12 rounded-full bg-gtn-purple text-white shadow-card hover:bg-gtn-purple-2 transition-colors md:bottom-6"
      >
        <HelpCircle size={22} />
      </Link>
    </Tooltip>
  );
}
