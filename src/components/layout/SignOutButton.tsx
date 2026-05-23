"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="p-2 rounded-md hover:bg-gtn-navy-2 text-white/80 hover:text-white"
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut className="h-5 w-5" aria-hidden />
    </button>
  );
}
