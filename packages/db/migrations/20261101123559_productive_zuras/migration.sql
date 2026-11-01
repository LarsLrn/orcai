ALTER TYPE "asset_origin" RENAME TO "asset_kept_in";--> statement-breakpoint
ALTER TABLE "asset" RENAME COLUMN "origin" TO "kept_in";--> statement-breakpoint
-- Stored findAssets parts name where an asset is kept `keptIn`, in the input filter and in each listed asset.
CREATE FUNCTION pg_temp.kept_in(obj jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
	SELECT CASE
		WHEN jsonb_typeof(obj) = 'object' AND obj ? 'origin' THEN
			(obj - 'origin') || jsonb_build_object('keptIn', coalesce(obj -> 'keptIn', obj -> 'origin'))
		ELSE obj
	END
$$;--> statement-breakpoint
CREATE FUNCTION pg_temp.migrated_part(part jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
	IF jsonb_typeof(part) <> 'object' OR part ->> 'type' IS DISTINCT FROM 'tool-findAssets' THEN
		RETURN part;
	END IF;

	IF jsonb_typeof(part -> 'input') = 'object' THEN
		part := jsonb_set(part, '{input}', pg_temp.kept_in(part -> 'input'));
	END IF;
	IF jsonb_typeof(part #> '{output,assets}') = 'array' THEN
		part := jsonb_set(part, '{output,assets}', (
			SELECT coalesce(jsonb_agg(pg_temp.kept_in(asset) ORDER BY position), '[]'::jsonb)
			FROM jsonb_array_elements(part #> '{output,assets}') WITH ORDINALITY AS assets(asset, position)
		));
	END IF;

	RETURN part;
END
$$;--> statement-breakpoint
CREATE FUNCTION pg_temp.migrated_parts(parts jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
	SELECT CASE
		WHEN jsonb_typeof(parts) = 'array' THEN (
			SELECT coalesce(jsonb_agg(pg_temp.migrated_part(part) ORDER BY position), '[]'::jsonb)
			FROM jsonb_array_elements(parts) WITH ORDINALITY AS elements(part, position)
		)
		ELSE parts
	END
$$;--> statement-breakpoint
UPDATE "chat_message"
SET "parts" = "migrated"."parts"::json
FROM (
	SELECT "id", pg_temp.migrated_parts("parts"::jsonb) AS "parts"
	FROM "chat_message"
	WHERE "parts"::text LIKE '%"tool-findAssets"%'
) AS "migrated"
WHERE "chat_message"."id" = "migrated"."id"
	AND "migrated"."parts" IS DISTINCT FROM "chat_message"."parts"::jsonb;--> statement-breakpoint
DROP FUNCTION pg_temp.migrated_parts(jsonb);--> statement-breakpoint
DROP FUNCTION pg_temp.migrated_part(jsonb);--> statement-breakpoint
DROP FUNCTION pg_temp.kept_in(jsonb);
