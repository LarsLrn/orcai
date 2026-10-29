-- A listed bot contains only listed blocks. A public bot with a private block
-- becomes private, with its public tuple; its owner lists it again in the app,
-- confirming its blocks.
CREATE TEMPORARY TABLE "exposing_bot" AS
SELECT "bot_visibility"."resource_id" AS "bot_id"
FROM "resource_visibility" AS "bot_visibility"
WHERE "bot_visibility"."resource_type" = 'bot'
	AND "bot_visibility"."visibility" = 'public'
	AND EXISTS (
		SELECT 1 FROM "bot_block"
		LEFT JOIN "resource_visibility" AS "block_visibility"
			ON "block_visibility"."resource_type" = 'block'
			AND "block_visibility"."resource_id" = "bot_block"."block_id"
		WHERE "bot_block"."bot_id" = "bot_visibility"."resource_id"
			AND "block_visibility"."visibility" IS DISTINCT FROM 'public'
	);--> statement-breakpoint
DO $$
DECLARE
	"bots" bigint;
BEGIN
	SELECT count(*) INTO "bots" FROM "exposing_bot";
	RAISE NOTICE 'public bots with private blocks made private: %', "bots";
END;
$$;--> statement-breakpoint
INSERT INTO "authz_outbox" ("event_type", "payload_json", "status")
SELECT 'spice.write-relationships', json_build_object('mutations', json_agg(json_build_object(
	'resourceType', 'bot',
	'resourceId', "bot_id",
	'relation', 'public',
	'subjectType', 'user',
	'subjectId', '*',
	'operation', 'delete'
))), 'pending'
FROM (
	SELECT "bot_id", (row_number() OVER (ORDER BY "bot_id") - 1) / 500 AS "chunk"
	FROM "exposing_bot"
) AS "bots"
GROUP BY "chunk";--> statement-breakpoint
UPDATE "resource_visibility"
SET "visibility" = 'private', "updated_at" = now()
FROM "exposing_bot"
WHERE "resource_visibility"."resource_type" = 'bot'
	AND "resource_visibility"."resource_id" = "exposing_bot"."bot_id";--> statement-breakpoint
DROP TABLE "exposing_bot";
