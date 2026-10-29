CREATE TYPE "activity_run_kind" AS ENUM('upload', 'fill_metadata', 'suggest_metadata', 'retry', 'export');--> statement-breakpoint
CREATE TYPE "activity_stage_state" AS ENUM('pending', 'completed', 'failed', 'replaced');--> statement-breakpoint
CREATE TABLE "activity_admission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"run_id" uuid NOT NULL,
	"lease_until" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_dismissal" (
	"user_id" uuid,
	"occurrence_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activity_dismissal_pkey" PRIMARY KEY("user_id","occurrence_id")
);
--> statement-breakpoint
CREATE TABLE "activity_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"run_id" uuid NOT NULL,
	"asset_id" uuid,
	"block_id" uuid,
	"data_export_id" uuid,
	"processing_state" "activity_stage_state",
	"processing_failure_id" uuid,
	"metadata_state" "activity_stage_state",
	"metadata_failure_id" uuid,
	"indexing_state" "activity_stage_state",
	"indexing_failure_id" uuid,
	"applied_fields" text[],
	CONSTRAINT "activity_member_target_check" CHECK (("asset_id" is null) <> ("data_export_id" is null) and ("block_id" is null or "asset_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "activity_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"kind" "activity_run_kind" NOT NULL,
	"organization_id" uuid,
	"block_id" uuid,
	"client_key" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_seen_at" timestamp,
	"dismissed_at" timestamp,
	CONSTRAINT "activity_run_client_key_unique" UNIQUE("user_id","client_key")
);
--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "processing_failure_id" uuid;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "processing_actor_id" uuid;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "metadata_failure_id" uuid;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "metadata_actor_id" uuid;--> statement-breakpoint
ALTER TABLE "block_asset" ADD COLUMN "index_failure_id" uuid;--> statement-breakpoint
ALTER TABLE "block_asset" ADD COLUMN "index_actor_id" uuid;--> statement-breakpoint
CREATE INDEX "activity_admission_run_idx" ON "activity_admission" ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_member_asset_unique" ON "activity_member" ("run_id","asset_id") WHERE "asset_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_member_export_unique" ON "activity_member" ("data_export_id") WHERE "data_export_id" is not null;--> statement-breakpoint
CREATE INDEX "activity_member_pending_idx" ON "activity_member" ("run_id") WHERE 'pending' in ("processing_state", "metadata_state", "indexing_state");--> statement-breakpoint
CREATE INDEX "activity_member_asset_idx" ON "activity_member" ("asset_id");--> statement-breakpoint
CREATE INDEX "activity_run_user_created_idx" ON "activity_run" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "asset_processing_failed_owner_idx" ON "asset" (coalesce("processing_actor_id", "user_id")) WHERE "processing_status" = 'failed';--> statement-breakpoint
CREATE INDEX "asset_processing_failure_idx" ON "asset" ("processing_failure_id") WHERE "processing_failure_id" is not null;--> statement-breakpoint
CREATE INDEX "asset_metadata_failure_idx" ON "asset" ("metadata_failure_id") WHERE "metadata_failure_id" is not null;--> statement-breakpoint
CREATE INDEX "asset_metadata_attention_owner_idx" ON "asset" (coalesce("metadata_actor_id", "user_id")) WHERE "metadata_status" = 'failed' or "metadata_suggestion" is not null;--> statement-breakpoint
CREATE INDEX "block_asset_index_failure_idx" ON "block_asset" ("index_failure_id") WHERE "index_failure_id" is not null;--> statement-breakpoint
CREATE INDEX "block_asset_index_failed_actor_idx" ON "block_asset" ("index_actor_id") WHERE "index_status" = 'failed';--> statement-breakpoint
ALTER TABLE "activity_admission" ADD CONSTRAINT "activity_admission_run_id_activity_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "activity_run"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activity_dismissal" ADD CONSTRAINT "activity_dismissal_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activity_member" ADD CONSTRAINT "activity_member_run_id_activity_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "activity_run"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activity_member" ADD CONSTRAINT "activity_member_asset_id_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activity_member" ADD CONSTRAINT "activity_member_block_id_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "block"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "activity_member" ADD CONSTRAINT "activity_member_data_export_id_data_export_id_fkey" FOREIGN KEY ("data_export_id") REFERENCES "data_export"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activity_run" ADD CONSTRAINT "activity_run_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activity_run" ADD CONSTRAINT "activity_run_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activity_run" ADD CONSTRAINT "activity_run_block_id_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "block"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_processing_actor_id_user_id_fkey" FOREIGN KEY ("processing_actor_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_metadata_actor_id_user_id_fkey" FOREIGN KEY ("metadata_actor_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "block_asset" ADD CONSTRAINT "block_asset_index_actor_id_user_id_fkey" FOREIGN KEY ("index_actor_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
-- Failures from before activity get an occurrence id, so they can be dismissed.
UPDATE "asset" SET "processing_failure_id" = gen_random_uuid() WHERE "processing_status" = 'failed';--> statement-breakpoint
UPDATE "asset" SET "metadata_failure_id" = gen_random_uuid() WHERE "metadata_status" = 'failed';--> statement-breakpoint
UPDATE "block_asset" SET "index_failure_id" = gen_random_uuid() WHERE "index_status" = 'failed';
