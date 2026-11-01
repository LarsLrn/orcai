-- Answers cite by `<cite ref=R>`: `<cite chunk="R">` becomes that, the asset id, title and page tags of older answers keep only their text, and stored citations name their kind.
CREATE FUNCTION pg_temp.cites_rewritten(content text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
	rest text := content;
	rewritten text := '';
	start integer;
	tag text;
	attributes text;
	attribute text[];
	names text[];
	ref text;
	closing integer;
	next_tag integer;
BEGIN
	IF content !~ '<cite\s[^>]*\m(chunk|assetId|assetid|asset_id|title|page|pageNumber|page_number)\s*=' THEN
		RETURN content;
	END IF;

	LOOP
		start := strpos(rest, '<cite');
		EXIT WHEN start = 0;
		rewritten := rewritten || substr(rest, 1, start - 1);
		rest := substr(rest, start);
		-- A `>` inside a quoted value does not end the tag.
		tag := substring(rest from '^<cite(?:\s(?:[^>"'']|"[^"]*"|''[^'']*'')*)?>');

		IF tag IS NULL THEN
			rewritten := rewritten || '<cite';
			rest := substr(rest, 6);
			CONTINUE;
		END IF;

		rest := substr(rest, length(tag) + 1);
		attributes := substr(tag, length('<cite') + 1, length(tag) - length('<cite>'));
		-- Whole attributes, so a name inside a value or a longer name does not count.
		names := '{}';
		ref := NULL;
		FOR attribute IN
			SELECT regexp_matches(attributes, '([^\s"''=<>/]+)(?:\s*=\s*(?:"([^"]*)"|''([^'']*)''|([^\s"''=<>`]+)))?', 'g')
		LOOP
			names := names || attribute[1];
			IF attribute[1] = 'chunk' THEN
				ref := coalesce(attribute[2], attribute[3], attribute[4]);
			END IF;
		END LOOP;

		IF 'chunk' = ANY(names) THEN
			rewritten := rewritten || CASE
				WHEN ref ~ '^[kadw][0-9a-z]{6}$' THEN '<cite ref=' || ref || '>'
				WHEN ref IS NOT NULL THEN '<cite ref="' || replace(ref, '"', '&quot;') || '">'
				ELSE tag
			END;
		ELSIF NOT 'ref' = ANY(names)
			AND names && ARRAY['assetId', 'assetid', 'asset_id', 'title', 'page', 'pageNumber', 'page_number'] THEN
			-- An older tag keeps its text; one left open loses only its opening tag.
			closing := strpos(rest, '</cite>');
			next_tag := strpos(rest, '<cite');
			IF closing > 0 AND (next_tag = 0 OR closing < next_tag) THEN
				rewritten := rewritten || substr(rest, 1, closing - 1);
				rest := substr(rest, closing + length('</cite>'));
			END IF;
		ELSE
			rewritten := rewritten || tag;
		END IF;
	END LOOP;

	RETURN rewritten || rest;
END
$$;--> statement-breakpoint
-- Every string of a value, at any depth, rewritten.
CREATE FUNCTION pg_temp.strings_rewritten(value jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
	rewritten jsonb;
	key text;
	element jsonb;
BEGIN
	CASE jsonb_typeof(value)
		WHEN 'string' THEN
			RETURN to_jsonb(pg_temp.cites_rewritten(value #>> '{}'));
		WHEN 'array' THEN
			rewritten := '[]';
			FOR element IN SELECT elements.element FROM jsonb_array_elements(value) WITH ORDINALITY AS elements(element, position) ORDER BY position LOOP
				rewritten := rewritten || jsonb_build_array(
					CASE WHEN strpos(element::text, '<cite') = 0 THEN element ELSE pg_temp.strings_rewritten(element) END
				);
			END LOOP;
			RETURN rewritten;
		WHEN 'object' THEN
			rewritten := '{}';
			FOR key, element IN SELECT entries.key, entries.element FROM jsonb_each(value) AS entries(key, element) LOOP
				rewritten := rewritten || jsonb_build_object(
					key,
					CASE WHEN strpos(element::text, '<cite') = 0 THEN element ELSE pg_temp.strings_rewritten(element) END
				);
			END LOOP;
			RETURN rewritten;
		ELSE
			RETURN value;
	END CASE;
END
$$;--> statement-breakpoint
-- Text parts, and the input and output of display calls, whose prose fields take citations.
CREATE FUNCTION pg_temp.cited_part(part jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
	field text;
BEGIN
	IF jsonb_typeof(part) <> 'object' OR strpos(part::text, '<cite') = 0 THEN
		RETURN part;
	END IF;

	IF part ->> 'type' = 'text' AND jsonb_typeof(part -> 'text') = 'string' THEN
		RETURN jsonb_set(part, '{text}', pg_temp.strings_rewritten(part -> 'text'));
	END IF;

	IF part ->> 'type' IN ('tool-showChecklist', 'tool-showReview', 'tool-showMatrix', 'tool-showQuizResult') THEN
		FOREACH field IN ARRAY ARRAY['input', 'output'] LOOP
			IF part ? field THEN
				part := jsonb_set(part, ARRAY[field], pg_temp.strings_rewritten(part -> field));
			END IF;
		END LOOP;
	END IF;

	RETURN part;
END
$$;--> statement-breakpoint
CREATE FUNCTION pg_temp.cited_parts(parts jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
	SELECT CASE
		WHEN jsonb_typeof(parts) = 'array' THEN (
			SELECT coalesce(jsonb_agg(pg_temp.cited_part(part) ORDER BY position), '[]'::jsonb)
			FROM jsonb_array_elements(parts) WITH ORDINALITY AS elements(part, position)
		)
		ELSE parts
	END
$$;--> statement-breakpoint
-- Stored citations without a kind are of assets.
CREATE FUNCTION pg_temp.kinded_metadata(metadata jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
	SELECT CASE
		WHEN jsonb_typeof(metadata -> 'citations') = 'object' THEN jsonb_set(metadata, '{citations}', (
			SELECT coalesce(jsonb_object_agg(
				ref,
				CASE
					WHEN jsonb_typeof(citation) = 'object' AND NOT citation ? 'kind' THEN citation || '{"kind": "asset"}'
					ELSE citation
				END
			), '{}'::jsonb)
			FROM jsonb_each(metadata -> 'citations') AS citations(ref, citation)
		))
		ELSE metadata
	END
$$;--> statement-breakpoint
UPDATE "chat_message"
SET
	"parts" = CASE
		WHEN "cited"."parts" IS DISTINCT FROM "chat_message"."parts"::jsonb THEN "cited"."parts"::json
		ELSE "chat_message"."parts"
	END,
	"metadata" = CASE
		WHEN "cited"."metadata" IS DISTINCT FROM "chat_message"."metadata"::jsonb THEN "cited"."metadata"::json
		ELSE "chat_message"."metadata"
	END
FROM (
	SELECT
		"id",
		pg_temp.cited_parts("parts"::jsonb) AS "parts",
		pg_temp.kinded_metadata("metadata"::jsonb) AS "metadata"
	FROM "chat_message"
	WHERE "role" = 'assistant'
		AND (
			"parts"::text ~ '<cite\s[^>]*\m(chunk|assetId|assetid|asset_id|title|page|pageNumber|page_number)\s*='
			OR "metadata"::text LIKE '%"citations"%'
		)
) AS "cited"
WHERE "chat_message"."id" = "cited"."id"
	AND (
		"cited"."parts" IS DISTINCT FROM "chat_message"."parts"::jsonb
		OR "cited"."metadata" IS DISTINCT FROM "chat_message"."metadata"::jsonb
	);--> statement-breakpoint
DROP FUNCTION pg_temp.kinded_metadata(jsonb);--> statement-breakpoint
DROP FUNCTION pg_temp.cited_parts(jsonb);--> statement-breakpoint
DROP FUNCTION pg_temp.cited_part(jsonb);--> statement-breakpoint
DROP FUNCTION pg_temp.strings_rewritten(jsonb);--> statement-breakpoint
DROP FUNCTION pg_temp.cites_rewritten(text);
