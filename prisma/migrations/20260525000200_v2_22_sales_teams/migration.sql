-- v2.22 — Sales teams + territories + Daily.co video calls + AI sales coach

-- Extend ActivityType with engagement + call event types
ALTER TYPE "ActivityType" ADD VALUE 'DOOR_KNOCK';
ALTER TYPE "ActivityType" ADD VALUE 'GATEKEEPER_REJECTED';
ALTER TYPE "ActivityType" ADD VALUE 'MEETING_SET';
ALTER TYPE "ActivityType" ADD VALUE 'NOT_INTERESTED';
ALTER TYPE "ActivityType" ADD VALUE 'VIDEO_CALL';
ALTER TYPE "ActivityType" ADD VALUE 'AUDIO_CALL';

-- Extend AiFeatureKind with the new sales-coach feature
ALTER TYPE "AiFeatureKind" ADD VALUE 'SALES_COACH';

-- New enums
CREATE TYPE "TeamRole" AS ENUM ('LEAD', 'MEMBER');

CREATE TYPE "CallSessionStatus" AS ENUM ('ACTIVE', 'ENDED', 'FAILED');

-- Sales teams
CREATE TABLE "sales_teams" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "name"         TEXT         NOT NULL,
  "description"  TEXT,
  "service_lines" "ServiceLine"[] NOT NULL DEFAULT ARRAY[]::"ServiceLine"[],
  "active"       BOOLEAN      NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sales_teams_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sales_teams_name_key" ON "sales_teams"("name");

-- Sales team membership (many-to-many, primary flag per user)
CREATE TABLE "sales_team_members" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "team_id"    UUID         NOT NULL,
  "user_id"    UUID         NOT NULL,
  "is_primary" BOOLEAN      NOT NULL DEFAULT false,
  "role"       "TeamRole"   NOT NULL DEFAULT 'MEMBER',
  "joined_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_team_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sales_team_members_team_id_user_id_key"
  ON "sales_team_members"("team_id", "user_id");
CREATE INDEX "sales_team_members_user_id_idx" ON "sales_team_members"("user_id");
CREATE INDEX "sales_team_members_team_id_idx" ON "sales_team_members"("team_id");
ALTER TABLE "sales_team_members"
  ADD CONSTRAINT "sales_team_members_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "sales_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_team_members"
  ADD CONSTRAINT "sales_team_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sales territories (list-based + optional polygon)
CREATE TABLE "sales_territories" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "name"       TEXT         NOT NULL,
  "team_id"    UUID         NOT NULL,
  "states"     TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "zip_codes"  TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "cities"     JSONB        NOT NULL DEFAULT '[]'::JSONB,
  "polygon"    JSONB,
  "active"     BOOLEAN      NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sales_territories_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sales_territories_team_id_idx" ON "sales_territories"("team_id");
ALTER TABLE "sales_territories"
  ADD CONSTRAINT "sales_territories_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "sales_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sales call sessions (Daily.co room tracking)
CREATE TABLE "sales_call_sessions" (
  "id"                UUID                NOT NULL DEFAULT gen_random_uuid(),
  "lead_id"           UUID                NOT NULL,
  "initiator_user_id" UUID                NOT NULL,
  "daily_room_name"   TEXT                NOT NULL,
  "daily_room_url"    TEXT                NOT NULL,
  -- v2.22 fix — no DEFAULT for `kind` here because Postgres forbids
  -- referencing a newly-added enum value as a literal in the same
  -- transaction that ALTER TYPE...ADD VALUE'd it. The call-start API
  -- always sets `kind` explicitly. Schema-level @default removed too.
  "kind"              "ActivityType"      NOT NULL,
  "status"            "CallSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "started_at"        TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at"          TIMESTAMP(3),
  "duration_seconds"  INTEGER,
  "recording_url"     TEXT,
  "activity_id"       UUID,
  "created_at"        TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_call_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sales_call_sessions_daily_room_name_key"
  ON "sales_call_sessions"("daily_room_name");
CREATE INDEX "sales_call_sessions_lead_id_started_at_idx"
  ON "sales_call_sessions"("lead_id", "started_at");
ALTER TABLE "sales_call_sessions"
  ADD CONSTRAINT "sales_call_sessions_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_call_sessions"
  ADD CONSTRAINT "sales_call_sessions_initiator_user_id_fkey"
  FOREIGN KEY ("initiator_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Lead extensions: lat/lng + team/territory FKs
ALTER TABLE "leads"
  ADD COLUMN "address_lat"  DECIMAL(10, 7),
  ADD COLUMN "address_lng"  DECIMAL(10, 7),
  ADD COLUMN "geocoded_at"  TIMESTAMP(3),
  ADD COLUMN "team_id"      UUID,
  ADD COLUMN "territory_id" UUID;

CREATE INDEX "leads_team_id_idx" ON "leads"("team_id");
CREATE INDEX "leads_territory_id_idx" ON "leads"("territory_id");

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "sales_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads"
  ADD CONSTRAINT "leads_territory_id_fkey"
  FOREIGN KEY ("territory_id") REFERENCES "sales_territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
