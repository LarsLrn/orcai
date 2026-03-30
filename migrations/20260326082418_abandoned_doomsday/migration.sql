DELETE FROM "resource_grant" WHERE "resource_type" = 'course';--> statement-breakpoint
DELETE FROM "resource_scope" WHERE "resource_type" = 'course';--> statement-breakpoint
DELETE FROM "resource_visibility" WHERE "resource_type" = 'course';--> statement-breakpoint
DELETE FROM "authz_outbox"
WHERE "event_type" = 'spice.write-relationships'
  AND "status" IN ('pending', 'processing', 'failed')
  AND EXISTS (
    SELECT 1
    FROM json_array_elements(COALESCE("payload_json"->'mutations', '[]'::json)) AS mutation
    WHERE mutation->>'resourceType' = 'course'
      OR mutation->>'subjectType' = 'course'
      OR mutation->>'relation' = 'course'
  );--> statement-breakpoint
ALTER TABLE "resource_grant" ALTER COLUMN "resource_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "resource_scope" ALTER COLUMN "resource_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "resource_visibility" ALTER COLUMN "resource_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "resource_type";--> statement-breakpoint
CREATE TYPE "resource_type" AS ENUM('bot', 'block', 'asset');--> statement-breakpoint
ALTER TABLE "resource_grant" ALTER COLUMN "resource_type" SET DATA TYPE "resource_type" USING "resource_type"::"resource_type";--> statement-breakpoint
ALTER TABLE "resource_scope" ALTER COLUMN "resource_type" SET DATA TYPE "resource_type" USING "resource_type"::"resource_type";--> statement-breakpoint
ALTER TABLE "resource_visibility" ALTER COLUMN "resource_type" SET DATA TYPE "resource_type" USING "resource_type"::"resource_type";
