/**
 * v2.22 — Sales team helpers.
 *
 * Reps can belong to multiple teams (many-to-many via SalesTeamMember).
 * One membership per user can be `isPrimary` — that's the default
 * landing-view team. The rep's lead-list query unions all their team
 * memberships.
 */

import { prisma } from "@/lib/prisma";

export type TeamMembership = {
  teamId: string;
  teamName: string;
  isPrimary: boolean;
  role: "LEAD" | "MEMBER";
};

/** Return every team the user is a member of. */
export async function userTeams(userId: string): Promise<TeamMembership[]> {
  const rows = await prisma.salesTeamMember.findMany({
    where: { userId },
    include: { team: { select: { id: true, name: true, active: true } } },
    orderBy: [{ isPrimary: "desc" }, { joinedAt: "asc" }],
  });
  return rows
    .filter((r) => r.team.active)
    .map((r) => ({
      teamId: r.team.id,
      teamName: r.team.name,
      isPrimary: r.isPrimary,
      role: r.role,
    }));
}

/** Return just the team IDs a user belongs to (cheap version for RBAC checks). */
export async function userTeamIds(userId: string): Promise<string[]> {
  const rows = await prisma.salesTeamMember.findMany({
    where: { userId, team: { active: true } },
    select: { teamId: true },
  });
  return rows.map((r) => r.teamId);
}

/** True if the user is a member of the given team. */
export async function teamHasMember(teamId: string, userId: string): Promise<boolean> {
  const row = await prisma.salesTeamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { id: true },
  });
  return Boolean(row);
}
