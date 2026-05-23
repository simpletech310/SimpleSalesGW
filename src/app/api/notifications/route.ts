import { NextResponse } from "next/server";
import { jsonError, requireSessionUser } from "@/lib/api";
import { loadNotifications } from "@/lib/notifications";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const payload = await loadNotifications(user);
    return NextResponse.json(payload);
  } catch (err) {
    return jsonError(err);
  }
}
