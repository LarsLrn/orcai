-- Blocks are behaviours and repositories, a repository counts passages, and an asset's citation label is `citationLabel`.
-- Renames `old_key` to `new_key` in an object; an existing `new_key` wins and a null value is dropped.
CREATE FUNCTION pg_temp.renamed_key(obj jsonb, old_key text, new_key text) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
	SELECT CASE
		WHEN jsonb_typeof(obj) IS DISTINCT FROM 'object' OR NOT obj ? old_key THEN obj
		WHEN obj ? new_key OR jsonb_typeof(obj -> old_key) = 'null' THEN obj - old_key
		ELSE (obj - old_key) || jsonb_build_object(new_key, obj -> old_key)
	END
$$;--> statement-breakpoint
UPDATE "block" SET "type" = 'behaviour' WHERE "type" = 'template';--> statement-breakpoint
UPDATE "block" SET "type" = 'repository' WHERE "type" = 'database';--> statement-breakpoint
UPDATE "block" SET "config" = pg_temp.renamed_key("config"::jsonb, 'minReferences', 'minPassages')::json
WHERE jsonb_typeof("config"::jsonb) = 'object' AND "config"::jsonb ? 'minReferences';--> statement-breakpoint
UPDATE "block" SET "config" = pg_temp.renamed_key("config"::jsonb, 'maxReferences', 'maxPassages')::json
WHERE jsonb_typeof("config"::jsonb) = 'object' AND "config"::jsonb ? 'maxReferences';--> statement-breakpoint
UPDATE "block" SET "config" = pg_temp.renamed_key("config"::jsonb, 'defaultReferences', 'defaultPassages')::json
WHERE jsonb_typeof("config"::jsonb) = 'object' AND "config"::jsonb ? 'defaultReferences';--> statement-breakpoint
UPDATE "asset" SET "metadata" = pg_temp.renamed_key("metadata"::jsonb, 'citation', 'citationLabel')::json
WHERE jsonb_typeof("metadata"::jsonb) = 'object' AND "metadata"::jsonb ? 'citation';--> statement-breakpoint
UPDATE "asset"
SET "metadata_suggestion" = jsonb_set("metadata_suggestion"::jsonb, '{metadata}',
	pg_temp.renamed_key("metadata_suggestion"::jsonb -> 'metadata', 'citation', 'citationLabel'))::json
WHERE jsonb_typeof("metadata_suggestion"::jsonb -> 'metadata') = 'object'
	AND ("metadata_suggestion"::jsonb -> 'metadata') ? 'citation';--> statement-breakpoint
UPDATE "activity_member"
SET "applied_fields" = CASE
	WHEN 'citationLabel' = ANY("applied_fields") THEN array_remove("applied_fields", 'citation')
	ELSE array_replace("applied_fields", 'citation', 'citationLabel')
END
WHERE 'citation' = ANY("applied_fields");--> statement-breakpoint
-- Stored tool parts carry block types and citation labels at the paths their tools' schemas define.
CREATE FUNCTION pg_temp.block_type_at(doc jsonb, path text[]) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
	SELECT CASE doc #> path
		WHEN '"template"' THEN jsonb_set(doc, path, '"behaviour"')
		WHEN '"database"' THEN jsonb_set(doc, path, '"repository"')
		ELSE doc
	END
$$;--> statement-breakpoint
CREATE FUNCTION pg_temp.block_types_at(doc jsonb, path text[], inner_path text[]) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
	SELECT CASE
		WHEN jsonb_typeof(doc #> path) = 'array' THEN jsonb_set(doc, path, (
			SELECT coalesce(jsonb_agg(pg_temp.block_type_at(element, inner_path) ORDER BY position), '[]'::jsonb)
			FROM jsonb_array_elements(doc #> path) WITH ORDINALITY AS elements(element, position)
		))
		ELSE doc
	END
$$;--> statement-breakpoint
CREATE FUNCTION pg_temp.citation_label_at(doc jsonb, path text[]) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
	SELECT CASE
		WHEN jsonb_typeof(doc #> path) = 'object' THEN jsonb_set(doc, path, pg_temp.renamed_key(doc #> path, 'citation', 'citationLabel'))
		ELSE doc
	END
$$;--> statement-breakpoint
CREATE FUNCTION pg_temp.citation_labels_at(doc jsonb, path text[]) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
	SELECT CASE
		WHEN jsonb_typeof(doc #> path) = 'array' THEN jsonb_set(doc, path, (
			SELECT coalesce(jsonb_agg(pg_temp.renamed_key(element, 'citation', 'citationLabel') ORDER BY position), '[]'::jsonb)
			FROM jsonb_array_elements(doc #> path) WITH ORDINALITY AS elements(element, position)
		))
		ELSE doc
	END
$$;--> statement-breakpoint
CREATE FUNCTION pg_temp.migrated_part(part jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
	IF jsonb_typeof(part) <> 'object' THEN
		RETURN part;
	END IF;

	CASE part ->> 'type'
		WHEN 'tool-findBlocks' THEN
			part := pg_temp.block_type_at(part, '{input,type}');
		WHEN 'tool-findCatalogue' THEN
			part := pg_temp.block_type_at(part, '{input,kind}');
			part := pg_temp.block_types_at(part, '{output,entries}', '{kind}');
		WHEN 'tool-getBlock', 'tool-createBehaviour', 'tool-updateBehaviour' THEN
			part := pg_temp.block_type_at(part, '{output,type}');
		WHEN 'tool-getBot', 'tool-createBot', 'tool-updateBot' THEN
			part := pg_temp.block_type_at(part, '{output,behaviour,type}');
		WHEN 'tool-deleteBlock' THEN
			part := pg_temp.block_types_at(part, '{output,deleted}', '{type}');
			part := pg_temp.block_types_at(part, '{output,skipped}', '{type}');
		WHEN 'tool-listRepositoryAssets' THEN
			part := pg_temp.citation_labels_at(part, '{output,assets}');
		WHEN 'tool-getAssetPage' THEN
			part := pg_temp.citation_labels_at(part, '{output,matchedAssets}');
		WHEN 'tool-updateAsset' THEN
			part := pg_temp.citation_label_at(part, '{input,metadata}');
			part := pg_temp.citation_label_at(part, '{output,metadata}');
		ELSE
			NULL;
	END CASE;

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
	WHERE "parts"::text ~ '"tool-(findBlocks|findCatalogue|getBlock|createBehaviour|updateBehaviour|getBot|createBot|updateBot|deleteBlock|listRepositoryAssets|getAssetPage|updateAsset)"'
) AS "migrated"
WHERE "chat_message"."id" = "migrated"."id"
	AND "migrated"."parts" IS DISTINCT FROM "chat_message"."parts"::jsonb;--> statement-breakpoint
DROP FUNCTION pg_temp.migrated_parts(jsonb);--> statement-breakpoint
DROP FUNCTION pg_temp.migrated_part(jsonb);--> statement-breakpoint
DROP FUNCTION pg_temp.citation_labels_at(jsonb, text[]);--> statement-breakpoint
DROP FUNCTION pg_temp.citation_label_at(jsonb, text[]);--> statement-breakpoint
DROP FUNCTION pg_temp.block_types_at(jsonb, text[], text[]);--> statement-breakpoint
DROP FUNCTION pg_temp.block_type_at(jsonb, text[]);--> statement-breakpoint
DROP FUNCTION pg_temp.renamed_key(jsonb, text, text);
