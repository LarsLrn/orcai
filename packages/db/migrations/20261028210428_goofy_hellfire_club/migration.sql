-- A chat family takes the organisation of its root: its own, its provider's, its
-- model's, then its owner's earliest membership. A chat with none is deleted.
CREATE TEMPORARY TABLE "chat_organization_backfill" AS
WITH RECURSIVE "family" ("id", "root_id") AS (
	SELECT "id", "id" FROM "chat" WHERE "parent_chat_id" IS NULL
	UNION ALL
	SELECT "chat"."id", "family"."root_id"
	FROM "chat"
	JOIN "family" ON "chat"."parent_chat_id" = "family"."id"
),
"signal" AS (
	SELECT
		"chat"."id",
		"chat"."organization_id" AS "existing",
		"provider"."organization_id" AS "provider",
		"model_provider"."organization_id" AS "model",
		(
			SELECT "member"."organization_id"
			FROM "member"
			WHERE "member"."user_id" = "chat"."user_id"
			ORDER BY "member"."created_at", "member"."organization_id"
			LIMIT 1
		) AS "membership"
	FROM "chat"
	LEFT JOIN "provider" ON "provider"."id"::text = "chat"."config" ->> 'providerId'
	LEFT JOIN "model" ON "model"."id"::text = "chat"."config" ->> 'modelId'
	LEFT JOIN "provider" AS "model_provider" ON "model_provider"."id" = "model"."provider_id"
)
SELECT
	"chat"."id",
	"chat"."user_id",
	CASE
		WHEN "signal"."existing" IS NOT NULL THEN 'existing'
		WHEN "signal"."provider" IS NOT NULL THEN 'provider'
		WHEN "signal"."model" IS NOT NULL THEN 'model'
		WHEN "signal"."membership" IS NOT NULL THEN 'membership'
		ELSE 'deleted'
	END AS "step",
	coalesce("signal"."existing", "signal"."provider", "signal"."model", "signal"."membership") AS "organization_id"
FROM "chat"
LEFT JOIN "family" ON "family"."id" = "chat"."id"
JOIN "signal" ON "signal"."id" = coalesce("family"."root_id", "chat"."id");--> statement-breakpoint
DO $$
DECLARE
	"steps" text;
	"deleted" text;
BEGIN
	SELECT string_agg(format('%s %s', "chats", "step"), ', ' ORDER BY "step")
	INTO "steps"
	FROM (
		SELECT "step", count(*) AS "chats"
		FROM "chat_organization_backfill"
		GROUP BY "step"
	) AS "counts";
	SELECT string_agg(format('%s (owner %s)', "id", "user_id"), ', ' ORDER BY "id")
	INTO "deleted"
	FROM "chat_organization_backfill"
	WHERE "organization_id" IS NULL;
	RAISE LOG 'chat organisation backfill: %; deleted chats: %',
		coalesce("steps", 'none'),
		coalesce("deleted", 'none');
END;
$$;--> statement-breakpoint
UPDATE "chat"
SET "organization_id" = "backfill"."organization_id"
FROM "chat_organization_backfill" AS "backfill"
WHERE "chat"."id" = "backfill"."id" AND "chat"."organization_id" IS NULL;--> statement-breakpoint
DELETE FROM "chat"
WHERE "id" IN (
	SELECT "id" FROM "chat_organization_backfill" WHERE "organization_id" IS NULL
);--> statement-breakpoint
DROP TABLE "chat_organization_backfill";
