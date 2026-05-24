"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { STRINGS } from "@/lib/strings";

export function LoginForms() {
  const sp = useSearchParams();
  const router = useRouter();
  const callbackUrl = sp.get("callbackUrl") ?? "/";
  const [tab, setTab] = useState<"magic" | "password">("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitMagic(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn("resend", { email, callbackUrl, redirect: false });
      if (result?.error) {
        toast.error("Could not send magic link. Try password login instead.");
      } else {
        router.push("/login/check-email");
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        toast.error("Invalid email or password.");
      } else if (result?.ok) {
        router.push(callbackUrl);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <div role="tablist" className="grid grid-cols-2 bg-gtn-lavender rounded-md p-1 text-sm mb-5">
        <button
          role="tab"
          aria-selected={tab === "magic"}
          onClick={() => setTab("magic")}
          className={
            tab === "magic"
              ? "py-2 rounded bg-gtn-navy text-white font-medium"
              : "py-2 text-gtn-navy"
          }
        >
          Magic link
        </button>
        <button
          role="tab"
          aria-selected={tab === "password"}
          onClick={() => setTab("password")}
          className={
            tab === "password"
              ? "py-2 rounded bg-gtn-navy text-white font-medium"
              : "py-2 text-gtn-navy"
          }
        >
          Password
        </button>
      </div>

      {tab === "magic" ? (
        <form onSubmit={submitMagic} className="space-y-4">
          <p className="text-sm text-gtn-grey-2">{STRINGS.auth.magicLinkPrompt}</p>
          <div className="space-y-2">
            <Label htmlFor="email-magic">Email</Label>
            <Input
              id="email-magic"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gatewaytelnet.com"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Sending…" : "Email me a magic link"}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitPassword} className="space-y-4">
          <p className="text-sm text-gtn-grey-2">{STRINGS.auth.passwordPrompt}</p>
          <div className="space-y-2">
            <Label htmlFor="email-pw">Email</Label>
            <Input
              id="email-pw"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          {/* v2.20.3 — production hides the dev-seed password hint. In dev
              and Vercel preview deploys (NODE_ENV !== "production") it
              still renders so the team can sign in with the seed creds. */}
          {process.env.NODE_ENV !== "production" && (
            <p className="text-xs text-gtn-grey-3 text-center">
              Dev seed password: <code className="gtn-code-pill">gateway123</code>
            </p>
          )}
        </form>
      )}
    </div>
  );
}
