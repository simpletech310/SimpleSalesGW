import { NextResponse } from "next/server";

/**
 * STUB — ConnectWise PSA webhook endpoint.
 * Wire up in v1.1 once ConnectWise instance + auth details are confirmed.
 * For MVP, handoff outputs a copy-paste payload only.
 */
export async function POST() {
  return NextResponse.json(
    { error: "ConnectWise webhook not yet implemented. Tracked for v1.1." },
    { status: 501 },
  );
}
