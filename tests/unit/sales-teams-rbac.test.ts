import { describe, expect, it } from "vitest";
import { PipelineStage, Role } from "@prisma/client";
import { leadIsVisible, leadVisibilityFilter } from "@/lib/rbac";

/**
 * v2.22 — RBAC extensions for team membership.
 *
 * leadIsVisible() now grants access to a SALESPERSON who is a member
 * of the lead's team (in addition to ownership). leadVisibilityFilter()
 * unions ownership and team membership into a Prisma where-clause.
 */

const USER = "user-1";
const OWNER = "user-2";
const TEAM = "team-A";

describe("leadIsVisible — team membership", () => {
  it("SALESPERSON sees own lead", () => {
    expect(leadIsVisible(Role.SALESPERSON, USER, USER, PipelineStage.LEAD)).toBe(true);
  });

  it("SALESPERSON does NOT see a lead they don't own + no team match", () => {
    expect(leadIsVisible(Role.SALESPERSON, USER, OWNER, PipelineStage.LEAD)).toBe(false);
  });

  it("SALESPERSON sees a lead on their team even if they don't own it", () => {
    expect(
      leadIsVisible(Role.SALESPERSON, USER, OWNER, PipelineStage.LEAD, TEAM, [TEAM, "team-B"]),
    ).toBe(true);
  });

  it("SALESPERSON does NOT see a team's lead if they're not on that team", () => {
    expect(
      leadIsVisible(Role.SALESPERSON, USER, OWNER, PipelineStage.LEAD, TEAM, ["team-B"]),
    ).toBe(false);
  });

  it("SALES_MANAGER sees every lead (lead:view:all)", () => {
    expect(leadIsVisible(Role.SALES_MANAGER, USER, OWNER, PipelineStage.LEAD)).toBe(true);
  });

  it("VCIO stage restriction: sees Site Survey Scheduled+ only", () => {
    expect(leadIsVisible(Role.VCIO, USER, OWNER, PipelineStage.LEAD)).toBe(false);
    expect(leadIsVisible(Role.VCIO, USER, OWNER, PipelineStage.SITE_SURVEY_SCHEDULED)).toBe(true);
  });

  it("SUPERADMIN sees everything", () => {
    expect(leadIsVisible(Role.SUPERADMIN, USER, OWNER, PipelineStage.LEAD)).toBe(true);
  });
});

describe("leadVisibilityFilter — team membership", () => {
  it("SALESPERSON with no teams = ownerUserId filter", () => {
    const f = leadVisibilityFilter(Role.SALESPERSON, USER, []);
    expect(f).toEqual({ ownerUserId: USER });
  });

  it("SALESPERSON on one team unions OR { ownerUserId, teamId in [...] }", () => {
    const f = leadVisibilityFilter(Role.SALESPERSON, USER, ["team-A"]);
    expect(f).toEqual({
      OR: [{ ownerUserId: USER }, { teamId: { in: ["team-A"] } }],
    });
  });

  it("SALESPERSON on multiple teams includes all in the in-clause", () => {
    const f = leadVisibilityFilter(Role.SALESPERSON, USER, ["team-A", "team-B", "team-C"]);
    expect(f).toEqual({
      OR: [{ ownerUserId: USER }, { teamId: { in: ["team-A", "team-B", "team-C"] } }],
    });
  });

  it("SALES_MANAGER = empty filter (sees everything)", () => {
    expect(leadVisibilityFilter(Role.SALES_MANAGER, USER, [])).toEqual({});
  });

  it("VCIO = stage filter is Site Survey Scheduled onward", () => {
    expect(leadVisibilityFilter(Role.VCIO, USER, [])).toEqual({
      pipelineStage: { in: expect.arrayContaining([PipelineStage.SITE_SURVEY_SCHEDULED]) },
    });
  });
});
