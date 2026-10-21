CREATE TYPE "pipeline_failure" AS ENUM('unsupported', 'empty', 'extraction', 'timeout', 'other');--> statement-breakpoint
CREATE TYPE "pipeline_status" AS ENUM('pending', 'active', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "processing_failure" "pipeline_failure";--> statement-breakpoint
ALTER TABLE "block_asset" ADD COLUMN "index_status" "pipeline_status" DEFAULT 'pending'::"pipeline_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "block_asset" ADD COLUMN "index_failure" "pipeline_failure";--> statement-breakpoint
DELETE FROM "block_asset" a USING "block_asset" b WHERE a."block_id" = b."block_id" AND a."asset_id" = b."asset_id" AND a.ctid > b.ctid;--> statement-breakpoint
ALTER TABLE "block_asset" ADD PRIMARY KEY ("block_id","asset_id");--> statement-breakpoint
ALTER TABLE "asset" ALTER COLUMN "processing_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "asset" ALTER COLUMN "processing_status" SET DATA TYPE "pipeline_status" USING "processing_status"::"pipeline_status";--> statement-breakpoint
ALTER TABLE "asset" ALTER COLUMN "processing_status" SET DEFAULT 'pending'::"pipeline_status";