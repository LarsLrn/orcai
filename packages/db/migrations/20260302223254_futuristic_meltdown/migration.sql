CREATE TYPE "authz_outbox_status" AS ENUM('pending', 'processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "group_kind" AS ENUM('system', 'custom');--> statement-breakpoint
CREATE TYPE "group_system_key" AS ENUM('all_members');--> statement-breakpoint
CREATE TYPE "principal_type" AS ENUM('user', 'group');--> statement-breakpoint
CREATE TYPE "resource_grant_role" AS ENUM('viewer', 'editor', 'manager');--> statement-breakpoint
CREATE TYPE "resource_type" AS ENUM('course', 'bot', 'block', 'asset');--> statement-breakpoint
CREATE TYPE "resource_visibility_enum" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TYPE "organization_role" AS ENUM('owner', 'instructor', 'student');--> statement-breakpoint
CREATE TABLE "authz_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"seq" serial,
	"event_type" text NOT NULL,
	"payload_json" json NOT NULL,
	"status" "authz_outbox_status" DEFAULT 'pending'::"authz_outbox_status" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_bot" (
	"course_id" uuid,
	"bot_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_bot_pkey" PRIMARY KEY("course_id","bot_id")
);
--> statement-breakpoint
CREATE TABLE "group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" "group_kind" NOT NULL,
	"system_key" "group_system_key",
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "group_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"added_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "resource_grant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"resource_type" "resource_type" NOT NULL,
	"resource_id" uuid NOT NULL,
	"principal_type" "principal_type" NOT NULL,
	"principal_id" uuid NOT NULL,
	"role" "resource_grant_role" NOT NULL,
	"granted_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "resource_scope" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"resource_type" "resource_type" NOT NULL,
	"resource_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" uuid NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "resource_visibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"resource_type" "resource_type" NOT NULL,
	"resource_id" uuid NOT NULL,
	"visibility" "resource_visibility_enum" DEFAULT 'private'::"resource_visibility_enum" NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "course_invitation";--> statement-breakpoint
DROP TABLE "course_member";--> statement-breakpoint
ALTER TABLE "invitation" ALTER COLUMN "role" SET DATA TYPE "organization_role" USING "role"::"organization_role";--> statement-breakpoint
ALTER TABLE "invitation" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "role" SET DATA TYPE "organization_role" USING "role"::"organization_role";--> statement-breakpoint
CREATE INDEX "authz_outbox_status_idx" ON "authz_outbox" ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "authz_outbox_seq_unique" ON "authz_outbox" ("seq");--> statement-breakpoint
CREATE INDEX "authz_outbox_retry_idx" ON "authz_outbox" ("status","next_attempt_at","seq");--> statement-breakpoint
CREATE INDEX "authz_outbox_processing_idx" ON "authz_outbox" ("status","updated_at","seq");--> statement-breakpoint
CREATE INDEX "authz_outbox_pending_retry_idx" ON "authz_outbox" ("next_attempt_at","seq") WHERE "status" IN ('pending', 'failed');--> statement-breakpoint
CREATE INDEX "authz_outbox_processing_stale_idx" ON "authz_outbox" ("updated_at","seq") WHERE "status" = 'processing';--> statement-breakpoint
CREATE INDEX "course_bot_course_idx" ON "course_bot" ("course_id");--> statement-breakpoint
CREATE INDEX "course_bot_bot_idx" ON "course_bot" ("bot_id");--> statement-breakpoint
CREATE INDEX "group_org_idx" ON "group" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_org_name_unique" ON "group" ("organization_id",lower("name")) WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "group_org_system_key_unique" ON "group" ("organization_id","system_key") WHERE "system_key" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "group_member_group_idx" ON "group_member" ("group_id");--> statement-breakpoint
CREATE INDEX "group_member_user_idx" ON "group_member" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_member_active_unique" ON "group_member" ("group_id","user_id") WHERE "removed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "resource_grant_resource_idx" ON "resource_grant" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "resource_grant_principal_idx" ON "resource_grant" ("principal_type","principal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_grant_active_principal_unique" ON "resource_grant" ("resource_type","resource_id","principal_type","principal_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "resource_scope_resource_idx" ON "resource_scope" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "resource_scope_org_idx" ON "resource_scope" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_visibility_resource_unique" ON "resource_visibility" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "resource_visibility_resource_idx" ON "resource_visibility" ("resource_type","resource_id");--> statement-breakpoint
ALTER TABLE "course_bot" ADD CONSTRAINT "course_bot_course_id_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "course_bot" ADD CONSTRAINT "course_bot_bot_id_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bot"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "course_bot" ADD CONSTRAINT "course_bot_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_group_id_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_added_by_user_id_fkey" FOREIGN KEY ("added_by") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "resource_grant" ADD CONSTRAINT "resource_grant_granted_by_user_id_fkey" FOREIGN KEY ("granted_by") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "resource_scope" ADD CONSTRAINT "resource_scope_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_scope" ADD CONSTRAINT "resource_scope_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "resource_visibility" ADD CONSTRAINT "resource_visibility_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id");