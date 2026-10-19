CREATE FUNCTION "replace_image_placeholder_nodes"(node jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
	IF node ->> 'type' = 'image-placeholder' THEN
		RETURN '{"type":"paragraph"}'::jsonb;
	END IF;
	IF jsonb_typeof(node -> 'content') = 'array' THEN
		RETURN jsonb_set(node, '{content}', (
			SELECT coalesce(jsonb_agg("replace_image_placeholder_nodes"(child) ORDER BY position), '[]'::jsonb)
			FROM jsonb_array_elements(node -> 'content') WITH ORDINALITY AS children(child, position)
		));
	END IF;
	RETURN node;
END;
$$;--> statement-breakpoint
UPDATE "bot" SET "content_json" = "replace_image_placeholder_nodes"("content_json"::jsonb)::json WHERE "content_json"::text LIKE '%"image-placeholder"%';--> statement-breakpoint
UPDATE "block" SET "content_json" = "replace_image_placeholder_nodes"("content_json"::jsonb)::json WHERE "content_json"::text LIKE '%"image-placeholder"%';--> statement-breakpoint
DROP FUNCTION "replace_image_placeholder_nodes"(jsonb);
