import { GatewayLogo } from "@/components/brand/GatewayLogo";

export default function ExpiredPage() {
  return (
    <div className="min-h-dvh bg-gtn-navy flex flex-col">
      <header className="container py-3">
        <GatewayLogo variant="onDark" size="sm" />
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md bg-white rounded-lg shadow-card p-8 text-center">
          <h1 className="text-2xl font-bold text-gtn-navy">This link is no longer active.</h1>
          <p className="text-sm text-gtn-grey-2 mt-3">
            The assessment may already be complete, or the link has expired. Reach out to your Gateway contact for a fresh link.
          </p>
        </div>
      </main>
      <div className="bg-gtn-lavender text-center text-xs text-gtn-grey-2 py-4">
        © Gateway TelNet
      </div>
    </div>
  );
}
