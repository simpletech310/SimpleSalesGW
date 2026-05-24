import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { env } from "@/lib/env";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  role: z.nativeEnum(Role),
  password: z.string().min(8).max(120).optional(),
  active: z.boolean().default(true),
});

export async function GET() {
  try {
    const user = await requireSessionUser();
    // v2.22 — sales-rep:create can list users (needed for the Sales >
    // Reps page) but only sees salespeople. user:manage sees everyone.
    if (!can(user.role, "user:manage") && !can(user.role, "sales-rep:create")) {
      throw new ApiError(403, "Forbidden");
    }
    const filter = can(user.role, "user:manage") ? {} : { role: Role.SALESPERSON };
    const users = await prisma.user.findMany({
      where: filter,
      select: { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ users });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    // v2.22 — sales-rep:create is a scoped subset of user:manage.
    // SALES_MANAGER can hit this endpoint but is restricted to creating
    // SALESPERSON-role accounts only. SUPERADMIN (user:manage) can
    // create any role.
    const hasFullPerm = can(user.role, "user:manage");
    const hasScopedPerm = can(user.role, "sales-rep:create");
    if (!hasFullPerm && !hasScopedPerm) throw new ApiError(403, "Forbidden");
    const data = createSchema.parse(await req.json());
    if (!hasFullPerm && data.role !== Role.SALESPERSON) {
      throw new ApiError(
        403,
        "Sales managers can only create SALESPERSON accounts. Ask a Superadmin to create other roles.",
      );
    }
    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    const created = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        active: data.active,
        passwordHash,
      },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "User",
      entityId: created.id,
      action: "CREATE",
      after: { email: created.email, role: created.role, active: created.active },
      ...getAuditContext(req),
    });

    // v2.14 — send the new user a welcome email. Two flavors:
    //   - password set      → "you can sign in now; here's the URL"
    //   - no password set   → "sign in via the magic-link tab using your email"
    // If RESEND_API_KEY isn't configured we return inviteSent=false so the
    // admin sees a clear "share the password manually" message instead of
    // a misleading green toast.
    let inviteSent = false;
    let inviteSkipReason: string | null = null;
    const apiKey = env().RESEND_API_KEY;
    if (apiKey) {
      try {
        const baseUrl = env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
        const loginUrl = `${baseUrl}/login`;
        const wantsMagicLink = !data.password;
        const subject = wantsMagicLink
          ? `You've been added to ${env().NEXT_PUBLIC_APP_NAME}`
          : `Welcome to ${env().NEXT_PUBLIC_APP_NAME}`;
        const body = wantsMagicLink
          ? `Hi ${data.name},\n\n${user.name} added you to the Gateway TelNet sales portal as a ${data.role.replace(/_/g, " ")}.\n\nSign in by visiting ${loginUrl} and choosing the "Magic link" tab — we'll email you a one-time link.\n\nIf the magic-link tab doesn't work, ask ${user.name} to set you a password.\n\n—\n${env().NEXT_PUBLIC_APP_NAME}`
          : `Hi ${data.name},\n\n${user.name} created your account on the Gateway TelNet sales portal as a ${data.role.replace(/_/g, " ")}.\n\nSign in at ${loginUrl}. ${user.name} will share your temporary password separately.\n\n—\n${env().NEXT_PUBLIC_APP_NAME}`;
        const resend = new Resend(apiKey);
        const result = await resend.emails.send({
          from: env().EMAIL_FROM,
          to: data.email,
          subject,
          text: body,
          replyTo: env().EMAIL_REPLY_TO,
        });
        if (!result.error) inviteSent = true;
        else inviteSkipReason = result.error.message;
      } catch (sendErr) {
        inviteSkipReason = sendErr instanceof Error ? sendErr.message : "Send failed";
      }
    } else {
      inviteSkipReason = "RESEND_API_KEY not set — no email was sent. Share the credentials with the new user manually.";
    }

    return NextResponse.json(
      { user: created, inviteSent, inviteSkipReason },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err);
  }
}
