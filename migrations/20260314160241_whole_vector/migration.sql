CREATE TYPE "provider_metering_mode" AS ENUM('tokens', 'requests');--> statement-breakpoint
CREATE TYPE "quota_period_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "quota_pool_period_type" AS ENUM('weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "quota_usage_event_type" AS ENUM('reserved', 'finalized', 'released', 'failed');--> statement-breakpoint
CREATE TABLE "quota_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"quota_pool_id" uuid NOT NULL,
	"quota_period_id" uuid NOT NULL,
	"budget_amount" bigint NOT NULL,
	"reserved_amount" bigint DEFAULT 0 NOT NULL,
	"consumed_amount" bigint DEFAULT 0 NOT NULL,
	"remaining_amount" bigint NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"quota_pool_id" uuid NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"status" "quota_period_status" DEFAULT 'open'::"quota_period_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "quota_pool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"provider_id" uuid NOT NULL,
	"provider_model_id" uuid,
	"period_type" "quota_pool_period_type" NOT NULL,
	"budget_amount" bigint NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_pool_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"quota_pool_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"action_type" text NOT NULL,
	"before_state" json,
	"after_state" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_pool_group_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"quota_pool_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_usage_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"quota_pool_id" uuid NOT NULL,
	"quota_period_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"provider_model_id" uuid,
	"user_id" uuid NOT NULL,
	"app_request_id" text NOT NULL,
	"event_type" "quota_usage_event_type" NOT NULL,
	"reservation_key" text NOT NULL,
	"metering_mode" "provider_metering_mode" NOT NULL,
	"reserved_amount" bigint DEFAULT 0 NOT NULL,
	"actual_amount" bigint DEFAULT 0 NOT NULL,
	"request_count" integer,
	"input_tokens" bigint,
	"output_tokens" bigint,
	"total_tokens" bigint,
	"metadata" json,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- v1 rollout assumption: provider table is empty before this migration runs.
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "provider" LIMIT 1) THEN
		RAISE EXCEPTION 'Migration requires empty provider table before adding organization_id'
			USING HINT = 'This v1 migration intentionally does not backfill provider.organization_id. Start from an empty provider table.';
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "provider" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "provider" ADD COLUMN "metering_mode" "provider_metering_mode" DEFAULT 'tokens'::"provider_metering_mode" NOT NULL;--> statement-breakpoint
CREATE INDEX "provider_organization_idx" ON "provider" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quota_ledger_pool_period_unique" ON "quota_ledger" ("quota_pool_id","quota_period_id");--> statement-breakpoint
CREATE INDEX "quota_ledger_period_idx" ON "quota_ledger" ("quota_period_id");--> statement-breakpoint
CREATE INDEX "quota_period_pool_idx" ON "quota_period" ("quota_pool_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quota_period_open_unique" ON "quota_period" ("quota_pool_id") WHERE "status" = 'open';--> statement-breakpoint
CREATE INDEX "quota_pool_org_provider_idx" ON "quota_pool" ("organization_id","provider_id");--> statement-breakpoint
CREATE INDEX "quota_pool_provider_model_idx" ON "quota_pool" ("provider_id","provider_model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quota_pool_default_org_provider_unique" ON "quota_pool" ("organization_id","provider_id") WHERE "is_default" = true AND "provider_model_id" IS NULL AND "is_active" = true;--> statement-breakpoint
CREATE INDEX "quota_pool_audit_log_pool_idx" ON "quota_pool_audit_log" ("quota_pool_id","created_at");--> statement-breakpoint
CREATE INDEX "quota_pool_group_assignment_pool_idx" ON "quota_pool_group_assignment" ("quota_pool_id");--> statement-breakpoint
CREATE INDEX "quota_pool_group_assignment_group_idx" ON "quota_pool_group_assignment" ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quota_pool_group_assignment_active_unique" ON "quota_pool_group_assignment" ("quota_pool_id","group_id") WHERE "is_active" = true;--> statement-breakpoint
CREATE INDEX "quota_usage_event_pool_period_idx" ON "quota_usage_event" ("quota_pool_id","quota_period_id","occurred_at");--> statement-breakpoint
CREATE INDEX "quota_usage_event_app_request_idx" ON "quota_usage_event" ("app_request_id");--> statement-breakpoint
CREATE INDEX "quota_usage_event_reservation_key_idx" ON "quota_usage_event" ("reservation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "quota_usage_event_terminal_unique" ON "quota_usage_event" ("reservation_key") WHERE "event_type" IN ('finalized', 'released');--> statement-breakpoint
CREATE UNIQUE INDEX "quota_usage_event_reservation_event_unique" ON "quota_usage_event" ("reservation_key","event_type");--> statement-breakpoint
ALTER TABLE "provider" ADD CONSTRAINT "provider_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota_ledger" ADD CONSTRAINT "quota_ledger_quota_pool_id_quota_pool_id_fkey" FOREIGN KEY ("quota_pool_id") REFERENCES "quota_pool"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota_ledger" ADD CONSTRAINT "quota_ledger_quota_period_id_quota_period_id_fkey" FOREIGN KEY ("quota_period_id") REFERENCES "quota_period"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota_period" ADD CONSTRAINT "quota_period_quota_pool_id_quota_pool_id_fkey" FOREIGN KEY ("quota_pool_id") REFERENCES "quota_pool"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota_pool" ADD CONSTRAINT "quota_pool_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota_pool" ADD CONSTRAINT "quota_pool_provider_id_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota_pool" ADD CONSTRAINT "quota_pool_provider_model_id_model_id_fkey" FOREIGN KEY ("provider_model_id") REFERENCES "model"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "quota_pool" ADD CONSTRAINT "quota_pool_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "quota_pool_audit_log" ADD CONSTRAINT "quota_pool_audit_log_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota_pool_audit_log" ADD CONSTRAINT "quota_pool_audit_log_quota_pool_id_quota_pool_id_fkey" FOREIGN KEY ("quota_pool_id") REFERENCES "quota_pool"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota_pool_audit_log" ADD CONSTRAINT "quota_pool_audit_log_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "quota_pool_group_assignment" ADD CONSTRAINT "quota_pool_group_assignment_quota_pool_id_quota_pool_id_fkey" FOREIGN KEY ("quota_pool_id") REFERENCES "quota_pool"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota_pool_group_assignment" ADD CONSTRAINT "quota_pool_group_assignment_group_id_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota_pool_group_assignment" ADD CONSTRAINT "quota_pool_group_assignment_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD CONSTRAINT "quota_usage_event_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD CONSTRAINT "quota_usage_event_quota_pool_id_quota_pool_id_fkey" FOREIGN KEY ("quota_pool_id") REFERENCES "quota_pool"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD CONSTRAINT "quota_usage_event_quota_period_id_quota_period_id_fkey" FOREIGN KEY ("quota_period_id") REFERENCES "quota_period"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD CONSTRAINT "quota_usage_event_provider_id_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD CONSTRAINT "quota_usage_event_provider_model_id_model_id_fkey" FOREIGN KEY ("provider_model_id") REFERENCES "model"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD CONSTRAINT "quota_usage_event_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");