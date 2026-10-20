-- Image generation blocks and their authorization rows.
CREATE TEMP TABLE "removed_block" AS
SELECT 'block'::"resource_type" AS "resource_type", "id" AS "resource_id"
FROM "block"
WHERE "type" = 'imageGeneration';--> statement-breakpoint
INSERT INTO "authz_outbox" ("event_type", "payload_json", "status")
SELECT
	'spice.write-relationships',
	json_build_object('mutations', (
		jsonb_build_array(jsonb_build_object(
			'resourceType', r."resource_type", 'resourceId', r."resource_id", 'relation', 'public',
			'subjectType', 'user', 'subjectId', '*', 'operation', 'delete'
		))
		|| COALESCE((
			SELECT jsonb_agg(DISTINCT jsonb_build_object(
				'resourceType', r."resource_type", 'resourceId', r."resource_id", 'relation', 'owner',
				'subjectType', 'user', 'subjectId', s."assigned_by", 'operation', 'delete'
			))
			FROM "resource_scope" s
			WHERE s."resource_type" = r."resource_type" AND s."resource_id" = r."resource_id"
		), '[]'::jsonb)
		|| COALESCE((
			SELECT jsonb_agg(DISTINCT jsonb_build_object(
				'resourceType', r."resource_type", 'resourceId', r."resource_id", 'relation', g."role",
				'subjectType', g."principal_type", 'subjectId', g."principal_id", 'operation', 'delete'
			) || CASE WHEN g."principal_type" = 'group' THEN jsonb_build_object('subjectRelation', 'member') ELSE '{}'::jsonb END)
			FROM "resource_grant" g
			WHERE g."resource_type" = r."resource_type" AND g."resource_id" = r."resource_id" AND g."revoked_at" IS NULL
		), '[]'::jsonb)
		|| COALESCE((
			SELECT jsonb_agg(DISTINCT jsonb_build_object(
				'resourceType', r."resource_type", 'resourceId', r."resource_id", 'relation', 'bot',
				'subjectType', 'bot', 'subjectId', b."bot_id", 'operation', 'delete'
			))
			FROM "bot_block" b
			WHERE b."block_id" = r."resource_id"
		), '[]'::jsonb)
	)::json),
	'pending'
FROM "removed_block" r;--> statement-breakpoint
DELETE FROM "resource_grant" g USING "removed_block" r
WHERE g."resource_type" = r."resource_type" AND g."resource_id" = r."resource_id";--> statement-breakpoint
DELETE FROM "resource_visibility" v USING "removed_block" r
WHERE v."resource_type" = r."resource_type" AND v."resource_id" = r."resource_id";--> statement-breakpoint
DELETE FROM "resource_scope" s USING "removed_block" r
WHERE s."resource_type" = r."resource_type" AND s."resource_id" = r."resource_id";--> statement-breakpoint
DELETE FROM "block" b USING "removed_block" r
WHERE b."id" = r."resource_id";--> statement-breakpoint
DROP TABLE "removed_block";
