-- A grant was issued in its resource's home organisation. A resource or an
-- active grant without a home needs an operator to decide; revoked grants
-- without one are history and go.
DO $$
DECLARE
	"homeless_resources" text;
	"homeless_active_grants" bigint;
BEGIN
	SELECT string_agg(format('%s %s', "resources", "resource_type"), ', ' ORDER BY "resource_type")
	INTO "homeless_resources"
	FROM (
		SELECT "resource_type", count(*) AS "resources"
		FROM (
			SELECT 'bot'::resource_type AS "resource_type", "id" FROM "bot"
			UNION ALL SELECT 'block', "id" FROM "block"
			UNION ALL SELECT 'asset', "id" FROM "asset"
		) AS "resource"
		WHERE NOT EXISTS (
			SELECT 1 FROM "resource_scope"
			WHERE "resource_scope"."resource_type" = "resource"."resource_type"
				AND "resource_scope"."resource_id" = "resource"."id"
				AND "resource_scope"."is_primary"
				AND "resource_scope"."ended_at" IS NULL
		)
		GROUP BY "resource_type"
	) AS "counts";
	SELECT count(*)
	INTO "homeless_active_grants"
	FROM "resource_grant"
	WHERE "revoked_at" IS NULL
		AND NOT EXISTS (
			SELECT 1 FROM "resource_scope"
			WHERE "resource_scope"."resource_type" = "resource_grant"."resource_type"
				AND "resource_scope"."resource_id" = "resource_grant"."resource_id"
				AND "resource_scope"."is_primary"
				AND "resource_scope"."ended_at" IS NULL
		);
	IF "homeless_resources" IS NOT NULL THEN
		RAISE EXCEPTION 'resources without a home organisation: %; delete them or give them a primary resource_scope first',
			"homeless_resources";
	END IF;
	IF "homeless_active_grants" > 0 THEN
		RAISE EXCEPTION '% active resource grants have no home organisation; revoke them or give their resources a primary resource_scope first',
			"homeless_active_grants";
	END IF;
END;
$$;--> statement-breakpoint
UPDATE "resource_grant"
SET "organization_id" = "resource_scope"."organization_id"
FROM "resource_scope"
WHERE "resource_scope"."resource_type" = "resource_grant"."resource_type"
	AND "resource_scope"."resource_id" = "resource_grant"."resource_id"
	AND "resource_scope"."is_primary"
	AND "resource_scope"."ended_at" IS NULL;--> statement-breakpoint
DELETE FROM "resource_grant" WHERE "organization_id" IS NULL;
