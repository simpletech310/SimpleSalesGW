import { Suspense } from "react";
import { GatewayLogo } from "@/components/brand/GatewayLogo";
import { LoginForms } from "./LoginForms";
import { STRINGS } from "@/lib/strings";

export default function LoginPage() {
  return (
    <div className="min-h-dvh bg-gtn-navy flex flex-col">
      <div className="container py-6">
        <GatewayLogo variant="onDark" size="sm" />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md bg-white rounded-lg shadow-card p-8">
          <h1 className="text-2xl font-bold text-gtn-navy">{STRINGS.auth.title}</h1>
          <p className="text-sm text-gtn-grey-2 mt-1">{STRINGS.brand.tagline}</p>
          <Suspense>
            <LoginForms />
          </Suspense>
        </div>
      </div>
      <div className="bg-gtn-lavender text-center text-xs text-gtn-grey-2 py-4">
        © Gateway TelNet
      </div>
    </div>
  );
}
