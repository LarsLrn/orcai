-- Stored tool parts follow the glossary tool names and their renamed input and output keys.
CREATE FUNCTION pg_temp.renamed(obj jsonb, renames jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
	SELECT CASE
		WHEN jsonb_typeof(obj) = 'object' THEN (
			SELECT coalesce(jsonb_object_agg(coalesce(renames ->> key, key), value), '{}'::jsonb)
			FROM jsonb_each(obj)
		)
		ELSE obj
	END
$$;--> statement-breakpoint
CREATE FUNCTION pg_temp.renamed_at(doc jsonb, path text[], renames jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
	SELECT CASE
		WHEN jsonb_typeof(doc #> path) = 'object' THEN jsonb_set(doc, path, pg_temp.renamed(doc #> path, renames))
		ELSE doc
	END
$$;--> statement-breakpoint
-- Renames keys of each element of the array at `path`, or of the object at `inner` inside each element.
CREATE FUNCTION pg_temp.renamed_each_at(doc jsonb, path text[], renames jsonb, inner_path text[] DEFAULT '{}') RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
	SELECT CASE
		WHEN jsonb_typeof(doc #> path) = 'array' THEN jsonb_set(doc, path, (
			SELECT coalesce(jsonb_agg(
				CASE
					WHEN cardinality(inner_path) = 0 THEN pg_temp.renamed(element, renames)
					ELSE pg_temp.renamed_at(element, inner_path, renames)
				END
				ORDER BY position
			), '[]'::jsonb)
			FROM jsonb_array_elements(doc #> path) WITH ORDINALITY AS elements(element, position)
		))
		ELSE doc
	END
$$;--> statement-breakpoint
-- Maps the tool names in the string array at `path`.
CREATE FUNCTION pg_temp.names_at(doc jsonb, path text[], names jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
	SELECT CASE
		WHEN jsonb_typeof(doc #> path) = 'array' THEN jsonb_set(doc, path, (
			SELECT coalesce(jsonb_agg(
				CASE
					WHEN jsonb_typeof(element) = 'string' AND names ? (element #>> '{}') THEN names -> (element #>> '{}')
					ELSE element
				END
				ORDER BY position
			), '[]'::jsonb)
			FROM jsonb_array_elements(doc #> path) WITH ORDINALITY AS elements(element, position)
		))
		ELSE doc
	END
$$;--> statement-breakpoint
CREATE FUNCTION pg_temp.migrated_part(part jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
	names constant jsonb := '{
		"searchKnowledgeBase": "searchRepositories",
		"listKnowledgeBaseDocuments": "listRepositoryAssets",
		"getKnowledgeBasePage": "getAssetPage",
		"getKnowledgeBaseChunks": "getPassages",
		"createTemplate": "createBehaviour",
		"updateTemplate": "updateBehaviour",
		"installFromCatalogue": "addFromCatalogue",
		"uninstallResource": "removeFromOrganisation",
		"retryAsset": "prepareAssetAgain",
		"findPrincipals": "findPeople"
	}';
	target constant jsonb := '{"resourceType": "targetType", "resourceId": "targetId"}';
	grantee constant jsonb := '{"principalType": "granteeType", "principalId": "granteeId"}';
	tool text;
BEGIN
	IF jsonb_typeof(part) <> 'object' OR coalesce(part ->> 'type', '') NOT LIKE 'tool-%' THEN
		RETURN part;
	END IF;

	tool := substr(part ->> 'type', 6);
	IF names ? tool THEN
		tool := names ->> tool;
		part := jsonb_set(part, '{type}', to_jsonb('tool-' || tool));
	END IF;

	CASE tool
		WHEN 'getAssetPage' THEN
			part := pg_temp.renamed_at(part, '{input}', '{"documentTitleQuery": "assetTitleQuery"}');
			part := pg_temp.renamed_at(part, '{output}', '{"matchedDocuments": "matchedAssets"}');
		WHEN 'listRepositoryAssets' THEN
			part := pg_temp.renamed_at(part, '{output}', '{"documents": "assets"}');
		WHEN 'getPassages' THEN
			part := pg_temp.renamed_at(part, '{input}', '{"chunks": "passages"}');
		WHEN 'getBlock' THEN
			part := pg_temp.renamed_at(part, '{output}', '{"documents": "assetTotals"}');
		WHEN 'getBot' THEN
			part := pg_temp.renamed_at(part, '{output}', '{"template": "behaviour"}');
		WHEN 'createBot', 'updateBot' THEN
			part := pg_temp.renamed_at(part, '{input}', '{"templateId": "behaviourId"}');
			part := pg_temp.renamed_at(part, '{output}', '{"template": "behaviour"}');
		WHEN 'findCatalogue' THEN
			part := pg_temp.renamed_each_at(part, '{output,entries}', '{"documents": "assets"}');
			part := pg_temp.renamed_each_at(part, '{output,entries}', target, '{entry}');
		WHEN 'addFromCatalogue', 'removeFromOrganisation' THEN
			part := pg_temp.renamed_at(part, '{input,entry}', target);
			part := pg_temp.renamed_at(part, '{output}', target);
		WHEN 'listAccess' THEN
			part := pg_temp.renamed_at(part, '{input}', target);
			part := pg_temp.renamed_each_at(part, '{output,grants}', grantee);
			part := pg_temp.renamed_each_at(part, '{output,inherited,through}', target);
		WHEN 'findPeople' THEN
			part := pg_temp.renamed_at(part, '{input}', target || '{"principalType": "granteeType"}');
			part := pg_temp.renamed_at(part, '{output}', '{"principals": "grantees"}');
			part := pg_temp.renamed_each_at(part, '{output,grantees}', grantee);
		WHEN 'grantAccess' THEN
			part := pg_temp.renamed_at(part, '{input}', target || '{"principals": "grantees"}');
			part := pg_temp.renamed_each_at(part, '{input,grantees}', grantee);
			part := pg_temp.renamed_at(part, '{output}', target);
			part := pg_temp.renamed_each_at(part, '{output,granted}', grantee);
		WHEN 'revokeAccess' THEN
			part := pg_temp.renamed_at(part, '{input}', target || grantee);
			part := pg_temp.renamed_at(part, '{output}', target || grantee);
		WHEN 'loadTools' THEN
			IF jsonb_typeof(part #> '{output,groups}') = 'array' THEN
				part := jsonb_set(part, '{output,groups}', (
					SELECT coalesce(jsonb_agg(
						pg_temp.names_at(pg_temp.names_at(tool_group, '{tools}', names), '{lockedUntilPlanApproved}', names)
						ORDER BY position
					), '[]'::jsonb)
					FROM jsonb_array_elements(part #> '{output,groups}') WITH ORDINALITY AS tool_groups(tool_group, position)
				));
			END IF;
		WHEN 'updatePlan' THEN
			part := pg_temp.names_at(part, '{output,unlockedTools}', names);
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
	WHERE "parts"::text LIKE '%"tool-%'
) AS "migrated"
WHERE "chat_message"."id" = "migrated"."id"
	AND "migrated"."parts" IS DISTINCT FROM "chat_message"."parts"::jsonb;--> statement-breakpoint
DROP FUNCTION pg_temp.migrated_parts(jsonb);--> statement-breakpoint
DROP FUNCTION pg_temp.migrated_part(jsonb);--> statement-breakpoint
DROP FUNCTION pg_temp.names_at(jsonb, text[], jsonb);--> statement-breakpoint
DROP FUNCTION pg_temp.renamed_each_at(jsonb, text[], jsonb, text[]);--> statement-breakpoint
DROP FUNCTION pg_temp.renamed_at(jsonb, text[], jsonb);--> statement-breakpoint
DROP FUNCTION pg_temp.renamed(jsonb, jsonb);
