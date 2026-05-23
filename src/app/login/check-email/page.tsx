import Link from "next/link";
import { GatewayLogo } from "@/components/brand/GatewayLogo";
import { STRINGS } from "@/lib/strings";

export default function CheckEmailPage() {
  return (
    <div className="min-h-dvh bg-gtn-navy flex flex-col">
      <div className="container py-6">
        <GatewayLogo variant="onDark" size="sm" />
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-card p-8 text-center">
          <h1 className="text-2xl font-bold text-gtn-navy">Check your email</h1>
          <p className="text-sm text-gtn-grey-2 mt-2">{STRINGS.auth.checkEmail}</p>
          <Link className="text-gtn-purple text-sm mt-6 inline-block underline" href="/login">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
