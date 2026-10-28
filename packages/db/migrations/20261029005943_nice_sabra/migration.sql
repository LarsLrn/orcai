ALTER TABLE "asset" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "metadata_status" "pipeline_status";--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "metadata_failure" "pipeline_failure";--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "metadata_suggestion" json;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "metadata_generation" integer DEFAULT 0 NOT NULL;