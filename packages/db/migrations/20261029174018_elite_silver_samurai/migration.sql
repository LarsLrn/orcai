CREATE SEQUENCE "public"."block_asset_index_attempt_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
ALTER TABLE "block_asset" ADD COLUMN "index_attempt" bigint DEFAULT nextval('block_asset_index_attempt_seq') NOT NULL;--> statement-breakpoint
ALTER TABLE "block_asset" ADD COLUMN "indexed_attempt" bigint;--> statement-breakpoint
-- Links that exist now stand for attempt 0, the attempt of jobs and points from before attempts existed; it counts as indexed once it finished.
UPDATE "block_asset" SET "index_attempt" = 0, "indexed_attempt" = CASE WHEN "index_status" IN ('pending', 'active') THEN NULL ELSE 0 END;
