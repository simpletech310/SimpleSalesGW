import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { loadProfile } from "@/lib/msp/loader";
import { DEFAULT_PROFILE } from "@/lib/msp/profile";
import { ListPage } from "@/components/templates";
import { MspProfileEditor } from "./MspProfileEditor";

export default async function MspProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "msp:profile:edit")) redirect("/");

  const profile = await loadProfile();

  return (
    <ListPage
      title="MSP business profile"
      subtitle="Every Claude prompt in the platform reads this profile so AI output reflects your mission, voice, service emphasis, and real win stories — not generic copy. Changes apply to the next AI call. Cached for 30 seconds; the cache is cleared on every save."
      crumbs={[{ href: "/admin", label: "Admin" }, { label: "MSP profile" }]}
    >
      <MspProfileEditor initialProfile={profile} defaultProfile={DEFAULT_PROFILE} />
    </ListPage>
  );
}
