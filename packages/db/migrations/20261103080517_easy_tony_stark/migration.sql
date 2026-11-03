-- Stored list and find calls page instead of taking a limit, and findPeople counts in `total`.
CREATE FUNCTION pg_temp.migrated_part(part jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
	IF jsonb_typeof(part) <> 'object' OR NOT coalesce(part ->> 'type' = ANY (ARRAY[
		'tool-findBots',
		'tool-findBlocks',
		'tool-findAssets',
		'tool-listMembers',
		'tool-listGroups',
		'tool-findCatalogue',
		'tool-findModels',
		'tool-listGroupMembers',
		'tool-listInvitations',
		'tool-findPeople'
	]), false) THEN
		RETURN part;
	END IF;

	IF jsonb_typeof(part -> 'input') = 'object' THEN
		part := jsonb_set(part, '{input}', (part -> 'input') - 'limit');
	END IF;
	IF part ->> 'type' = 'tool-findPeople' AND jsonb_typeof(part -> 'output') = 'object' AND part -> 'output' ? 'count' THEN
		part := jsonb_set(part, '{output}', ((part -> 'output') - 'count') || jsonb_build_object('total', part #> '{output,count}'));
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
	WHERE "parts"::text ~ '"tool-(find|list)'
) AS "migrated"
WHERE "chat_message"."id" = "migrated"."id"
	AND "migrated"."parts" IS DISTINCT FROM "chat_message"."parts"::jsonb;--> statement-breakpoint
DROP FUNCTION pg_temp.migrated_parts(jsonb);--> statement-breakpoint
DROP FUNCTION pg_temp.migrated_part(jsonb);
