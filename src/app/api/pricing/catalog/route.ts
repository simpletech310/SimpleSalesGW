import { NextResponse } from "next/server";
import { jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { loadCatalog } from "@/lib/pricing/loader";

/**
 * Returns the active pricing catalog.
 * - Anyone authenticated sees sticker pricing.
 * - Floor values are scrubbed unless the user has pricing:view:floor.
 */
export async function GET() {
  try {
    const user = await requireSessionUser();
    const catalog = await loadCatalog();
    const seeFloor = can(user.role, "pricing:view:floor");

    if (!seeFloor) {
      // Zero out floor figures for non-privileged viewers.
      const scrubbed: typeof catalog = {
        ...catalog,
        bundles: Object.fromEntries(
          Object.entries(catalog.bundles).map(([id, b]) => [
            id,
            {
              ...b,
              seatTiers: b.seatTiers.map((t) => ({ ...t, perSeatFloor: 0 })),
            },
          ]),
        ) as unknown as typeof catalog.bundles,
        standalone: Object.fromEntries(
          Object.entries(catalog.standalone).map(([k, v]) =>
            v ? [k, { ...v, perSeatFloor: 0 }] : [k, v],
          ),
        ) as unknown as typeof catalog.standalone,
      };
      return NextResponse.json({ catalog: scrubbed, canSeeFloor: false });
    }

    return NextResponse.json({ catalog, canSeeFloor: true });
  } catch (err) {
    return jsonError(err);
  }
}
