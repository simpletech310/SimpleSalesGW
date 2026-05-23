import { GatewayLogo } from "@/components/brand/GatewayLogo";

export default function DonePage() {
  return (
    <div className="min-h-dvh bg-gtn-navy flex flex-col">
      <header className="container py-3">
        <GatewayLogo variant="onDark" size="sm" />
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md bg-white rounded-lg shadow-card p-8 text-center">
          <h1 className="text-2xl font-bold text-gtn-navy">Thanks &mdash; you&apos;re all set.</h1>
          <p className="text-sm text-gtn-grey-2 mt-3">
            Your responses are in. Lin will follow up with the next steps based on what you shared.
          </p>
          <p className="text-xs text-gtn-grey-3 mt-6">You can close this window.</p>
        </div>
      </main>
      <div className="bg-gtn-lavender text-center text-xs text-gtn-grey-2 py-4">
        © Gateway TelNet
      </div>
    </div>
  );
}
