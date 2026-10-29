-- A bot links only blocks scoped to its home organisation, and a chat attaches
-- only blocks scoped to its own. Links that are not go, with their tuples.
CREATE TEMPORARY TABLE "foreign_bot_block" AS
SELECT "bot_block"."bot_id", "bot_block"."block_id"
FROM "bot_block"
JOIN "resource_scope" AS "home"
	ON "home"."resource_type" = 'bot'
	AND "home"."resource_id" = "bot_block"."bot_id"
	AND "home"."is_primary"
	AND "home"."ended_at" IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM "resource_scope"
	WHERE "resource_scope"."resource_type" = 'block'
		AND "resource_scope"."resource_id" = "bot_block"."block_id"
		AND "resource_scope"."organization_id" = "home"."organization_id"
		AND "resource_scope"."ended_at" IS NULL
);--> statement-breakpoint
CREATE TEMPORARY TABLE "foreign_chat_block" AS
SELECT "chat_block"."chat_id", "chat_block"."block_id"
FROM "chat_block"
JOIN "chat" ON "chat"."id" = "chat_block"."chat_id"
WHERE NOT EXISTS (
	SELECT 1 FROM "resource_scope"
	WHERE "resource_scope"."resource_type" = 'block'
		AND "resource_scope"."resource_id" = "chat_block"."block_id"
		AND "resource_scope"."organization_id" = "chat"."organization_id"
		AND "resource_scope"."ended_at" IS NULL
);--> statement-breakpoint
DO $$
DECLARE
	"bots" text;
	"chats" bigint;
BEGIN
	SELECT string_agg(format('%s (%s blocks)', "bot_id", "blocks"), ', ' ORDER BY "bot_id")
	INTO "bots"
	FROM (
		SELECT "bot_id", count(*) AS "blocks" FROM "foreign_bot_block" GROUP BY "bot_id"
	) AS "counts";
	SELECT count(DISTINCT "chat_id") INTO "chats" FROM "foreign_chat_block";
	RAISE LOG 'cross-organisation composition removed: bots %; chats with attachments removed: %',
		coalesce("bots", 'none'),
		"chats";
END;
$$;--> statement-breakpoint
INSERT INTO "authz_outbox" ("event_type", "payload_json", "status")
SELECT 'spice.write-relationships', json_build_object('mutations', json_agg(json_build_object(
	'resourceType', 'block',
	'resourceId', "block_id",
	'relation', 'bot',
	'subjectType', 'bot',
	'subjectId', "bot_id",
	'operation', 'delete'
))), 'pending'
FROM (
	SELECT "bot_id", "block_id", (row_number() OVER (ORDER BY "bot_id", "block_id") - 1) / 500 AS "chunk"
	FROM "foreign_bot_block"
) AS "links"
GROUP BY "chunk";--> statement-breakpoint
DELETE FROM "bot_block"
USING "foreign_bot_block"
WHERE "bot_block"."bot_id" = "foreign_bot_block"."bot_id"
	AND "bot_block"."block_id" = "foreign_bot_block"."block_id";--> statement-breakpoint
DELETE FROM "chat_block"
USING "foreign_chat_block"
WHERE "chat_block"."chat_id" = "foreign_chat_block"."chat_id"
	AND "chat_block"."block_id" = "foreign_chat_block"."block_id";--> statement-breakpoint
DROP TABLE "foreign_bot_block";--> statement-breakpoint
DROP TABLE "foreign_chat_block";
