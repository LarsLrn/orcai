-- One source per distinct leaf: every branch with a leaf in its own chat, or the newest message when a chat has none.
CREATE TEMP TABLE "flat_source" AS
SELECT DISTINCT ON (b."chat_id", b."leaf_message_id")
	b."id" AS "source_id",
	b."chat_id",
	b."leaf_message_id" AS "leaf_id",
	b."created_at",
	b."updated_at",
	b."id" IS NOT DISTINCT FROM c."active_branch_id" AS "is_active",
	false AS "is_primary"
FROM "chat_branch" b
JOIN "chat" c ON c."id" = b."chat_id"
JOIN "chat_message" l ON l."id" = b."leaf_message_id" AND l."chat_id" = b."chat_id"
ORDER BY b."chat_id", b."leaf_message_id", b."id" IS NOT DISTINCT FROM c."active_branch_id" DESC, b."updated_at" DESC, b."id";--> statement-breakpoint
INSERT INTO "flat_source"
SELECT DISTINCT ON (m."chat_id") gen_random_uuid(), m."chat_id", m."id", c."created_at", c."updated_at", true, false
FROM "chat_message" m
JOIN "chat" c ON c."id" = m."chat_id"
WHERE NOT EXISTS (SELECT 1 FROM "flat_source" s WHERE s."chat_id" = m."chat_id")
ORDER BY m."chat_id", m."created_at" DESC, m."id" DESC;--> statement-breakpoint
UPDATE "flat_source" s SET "is_primary" = true
FROM (
	SELECT DISTINCT ON ("chat_id") "source_id"
	FROM "flat_source"
	ORDER BY "chat_id", "is_active" DESC, "updated_at" DESC, "created_at" DESC, "source_id"
) p
WHERE s."source_id" = p."source_id";--> statement-breakpoint
CREATE TEMP TABLE "flat_path" AS
WITH RECURSIVE "walk" AS (
	SELECT s."source_id", m."id", m."chat_id", m."parent_message_id", 0 AS "step", ARRAY[m."id"] AS "seen"
	FROM "flat_source" s
	JOIN "chat_message" m ON m."id" = s."leaf_id"
	UNION ALL
	SELECT w."source_id", m."id", m."chat_id", m."parent_message_id", w."step" + 1, w."seen" || m."id"
	FROM "walk" w
	JOIN "chat_message" m ON m."id" = w."parent_message_id" AND m."chat_id" = w."chat_id"
	WHERE m."id" <> ALL (w."seen")
)
SELECT
	"source_id",
	"id" AS "message_id",
	max("step") OVER (PARTITION BY "source_id") - "step" AS "position",
	count(*) OVER (PARTITION BY "id") AS "reach"
FROM "walk";--> statement-breakpoint
CREATE TEMP TABLE "flat_chat" AS
SELECT
	s."source_id",
	gen_random_uuid() AS "chat_id",
	s."chat_id" AS "parent_chat_id",
	s."created_at",
	s."updated_at",
	(
		SELECT p."message_id"
		FROM "flat_path" p
		JOIN "flat_path" a ON a."message_id" = p."message_id"
		JOIN "flat_source" primary_source ON primary_source."source_id" = a."source_id" AND primary_source."is_primary"
		WHERE p."source_id" = s."source_id"
		ORDER BY p."position" DESC
		LIMIT 1
	) AS "fork_id"
FROM "flat_source" s
WHERE NOT s."is_primary";--> statement-breakpoint
UPDATE "chat_message" m SET "position" = p."position"
FROM "flat_path" p
JOIN "flat_source" s ON s."source_id" = p."source_id" AND s."is_primary"
WHERE m."id" = p."message_id";--> statement-breakpoint
INSERT INTO "chat" ("id", "title", "user_id", "bot_id", "parent_chat_id", "branched_from_message_id", "config", "created_at", "updated_at")
SELECT f."chat_id", c."title", c."user_id", c."bot_id", f."parent_chat_id", f."fork_id", c."config", f."created_at", f."updated_at"
FROM "flat_chat" f
JOIN "chat" c ON c."id" = f."parent_chat_id";--> statement-breakpoint
INSERT INTO "chat_block" ("block_id", "chat_id", "created_at")
SELECT cb."block_id", f."chat_id", cb."created_at"
FROM "flat_chat" f
JOIN "chat_block" cb ON cb."chat_id" = f."parent_chat_id";--> statement-breakpoint
INSERT INTO "chat_message" ("id", "chat_id", "role", "parts", "attachments", "metadata", "position", "created_at")
SELECT gen_random_uuid(), f."chat_id", m."role", m."parts", m."attachments", m."metadata", p."position", m."created_at"
FROM "flat_path" p
JOIN "flat_chat" f ON f."source_id" = p."source_id"
JOIN "chat_message" m ON m."id" = p."message_id"
WHERE p."reach" > 1;--> statement-breakpoint
UPDATE "chat_message" m SET "chat_id" = f."chat_id", "position" = p."position"
FROM "flat_path" p
JOIN "flat_chat" f ON f."source_id" = p."source_id"
WHERE m."id" = p."message_id" AND p."reach" = 1;--> statement-breakpoint
DELETE FROM "chat_branch";--> statement-breakpoint
DELETE FROM "chat_message" WHERE "position" IS NULL;--> statement-breakpoint
INSERT INTO "authz_outbox" ("event_type", "payload_json", "status")
SELECT
	'spice.write-relationships',
	json_build_object('mutations', (
		jsonb_build_array(jsonb_build_object(
			'resourceType', 'chat', 'resourceId', c."id", 'relation', 'owner',
			'subjectType', 'user', 'subjectId', c."user_id", 'operation', 'touch'
		))
		|| CASE WHEN c."bot_id" IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
			'resourceType', 'chat', 'resourceId', c."id", 'relation', 'bot',
			'subjectType', 'bot', 'subjectId', c."bot_id", 'operation', 'touch'
		)) END
	)::json),
	'pending'
FROM "flat_chat" f
JOIN "chat" c ON c."id" = f."chat_id";--> statement-breakpoint
DROP TABLE "flat_chat", "flat_path", "flat_source";
