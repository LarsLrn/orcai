UPDATE "asset" SET "processing_failure" = 'other' WHERE "processing_status" = 'failed';--> statement-breakpoint
UPDATE "block_asset" SET
	"index_status" = CASE "asset"."processing_status"
		WHEN 'completed' THEN 'completed'::"pipeline_status"
		WHEN 'failed' THEN 'failed'::"pipeline_status"
		ELSE 'pending'::"pipeline_status"
	END,
	"index_failure" = CASE "asset"."processing_status"
		WHEN 'failed' THEN 'other'::"pipeline_failure"
	END
FROM "asset"
WHERE "asset"."id" = "block_asset"."asset_id";
