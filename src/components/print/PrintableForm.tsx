import { GatewayLogo } from "@/components/brand/GatewayLogo";

/**
 * Shared print shell — Gateway navy header band + lavender footer + content.
 * Use with Tailwind `print:` classes on the page; this component supplies
 * the wrapping chrome.
 */
export function PrintableForm({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white min-h-screen text-gtn-text">
      {/* Screen-only Print button */}
      <div className="container py-4 print:hidden flex justify-end">
        <button
          onClick={() => globalThis.window?.print()}
          className="inline-flex items-center justify-center rounded-md bg-gtn-navy text-white px-4 py-2 text-sm font-medium hover:bg-gtn-navy-2"
        >
          Print this page
        </button>
      </div>

      <div className="container max-w-4xl mx-auto pb-12 print:pb-0">
        <header className="bg-gtn-navy text-white rounded-lg p-5 flex items-center justify-between mb-6 print:rounded-none print:mb-4">
          <GatewayLogo variant="onDark" size="md" />
          <div className="text-right">
            <p className="text-lg font-semibold">{title}</p>
            {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
          </div>
        </header>

        {children}

        <footer className="border-t border-gtn-lavender-2 pt-4 mt-8 text-xs text-gtn-grey-2 text-center print:mt-4">
          Gateway TelNet · Sales made simple. Operations made sure.
        </footer>
      </div>
    </div>
  );
}
