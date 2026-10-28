ALTER TABLE "asset" ALTER COLUMN "metadata" SET DEFAULT '{}';--> statement-breakpoint
UPDATE "asset"
SET "metadata" = ("metadata"::jsonb - 'showReference' - 'relevance')::json
WHERE "metadata"::jsonb ?| array['showReference', 'relevance'];
