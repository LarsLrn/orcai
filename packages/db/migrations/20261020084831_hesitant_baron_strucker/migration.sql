-- Authorization rows whose bot, block or asset is gone.
CREATE TEMP TABLE "orphan_resource" AS
SELECT r."resource_type", r."resource_id"
FROM (
	SELECT "resource_type", "resource_id" FROM "resource_scope"
	UNION SELECT "resource_type", "resource_id" FROM "resource_visibility"
	UNION SELECT "resource_type", "resource_id" FROM "resource_grant"
) r
WHERE NOT EXISTS (SELECT 1 FROM "bot" WHERE r."resource_type" = 'bot' AND "bot"."id" = r."resource_id")
	AND NOT EXISTS (SELECT 1 FROM "block" WHERE r."resource_type" = 'block' AND "block"."id" = r."resource_id")
	AND NOT EXISTS (SELECT 1 FROM "asset" WHERE r."resource_type" = 'asset' AND "asset"."id" = r."resource_id");--> statement-breakpoint
INSERT INTO "authz_outbox" ("event_type", "payload_json", "status")
SELECT
	'spice.write-relationships',
	json_build_object('mutations', (
		jsonb_build_array(jsonb_build_object(
			'resourceType', o."resource_type", 'resourceId', o."resource_id", 'relation', 'public',
			'subjectType', 'user', 'subjectId', '*', 'operation', 'delete'
		))
		|| COALESCE((
			SELECT jsonb_agg(DISTINCT jsonb_build_object(
				'resourceType', o."resource_type", 'resourceId', o."resource_id", 'relation', 'owner',
				'subjectType', 'user', 'subjectId', s."assigned_by", 'operation', 'delete'
			))
			FROM "resource_scope" s
			WHERE s."resource_type" = o."resource_type" AND s."resource_id" = o."resource_id"
		), '[]'::jsonb)
		|| COALESCE((
			SELECT jsonb_agg(DISTINCT jsonb_build_object(
				'resourceType', o."resource_type", 'resourceId', o."resource_id", 'relation', g."role",
				'subjectType', g."principal_type", 'subjectId', g."principal_id", 'operation', 'delete'
			) || CASE WHEN g."principal_type" = 'group' THEN jsonb_build_object('subjectRelation', 'member') ELSE '{}'::jsonb END)
			FROM "resource_grant" g
			WHERE g."resource_type" = o."resource_type" AND g."resource_id" = o."resource_id" AND g."revoked_at" IS NULL
		), '[]'::jsonb)
	)::json),
	'pending'
FROM "orphan_resource" o;--> statement-breakpoint
DELETE FROM "resource_grant" g USING "orphan_resource" o
WHERE g."resource_type" = o."resource_type" AND g."resource_id" = o."resource_id";--> statement-breakpoint
DELETE FROM "resource_visibility" v USING "orphan_resource" o
WHERE v."resource_type" = o."resource_type" AND v."resource_id" = o."resource_id";--> statement-breakpoint
DELETE FROM "resource_scope" s USING "orphan_resource" o
WHERE s."resource_type" = o."resource_type" AND s."resource_id" = o."resource_id";--> statement-breakpoint
DROP TABLE "orphan_resource";
