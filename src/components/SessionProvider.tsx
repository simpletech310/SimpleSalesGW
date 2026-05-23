"use client";

import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/Tooltip";

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </SessionProvider>
  );
}
