import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { loadProfile } from "@/lib/msp/loader";
import { DEFAULT_PROFILE } from "@/lib/msp/profile";
import { MspProfileEditor } from "./MspProfileEditor";

/**
 * v2.21 — /admin/msp-profile
 *
 * SUPERADMIN-only editor for the MSP business profile that feeds
 * every Claude prompt across the 6 AI features.
 */
export default async function MspProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "msp:profile:edit")) redirect("/");

  const profile = await loadProfile();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gtn-navy">MSP business profile</h1>
        <p className="text-sm text-gtn-grey-2 mt-1 max-w-3xl">
          Every Claude prompt in the platform reads this profile so AI output
          reflects your mission, voice, service emphasis, and real win stories
          — not generic copy. Changes apply to the next AI call. Cached for 30
          seconds; the cache is cleared on every save.
        </p>
      </div>

      <MspProfileEditor initialProfile={profile} defaultProfile={DEFAULT_PROFILE} />
    </div>
  );
}
