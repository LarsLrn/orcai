ALTER TABLE "block_asset" ADD COLUMN "indexed_title" text;--> statement-breakpoint
CREATE INDEX "asset_updated_idx" ON "asset" ("updated_at");--> statement-breakpoint
UPDATE "block_asset"
SET "indexed_title" = "asset"."title"
FROM "asset"
WHERE "asset"."id" = "block_asset"."asset_id" AND "block_asset"."indexed_attempt" IS NOT NULL;
