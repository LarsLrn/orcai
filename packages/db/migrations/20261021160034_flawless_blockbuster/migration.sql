UPDATE "chat_message"
SET
	"attachments" = (
		SELECT coalesce(
			jsonb_agg(
				jsonb_build_object(
					'assetId', attachment -> 'assetId',
					'title', attachment -> 'title',
					'fileType', attachment -> 'fileType',
					'size', attachment -> 'size'
				)
				ORDER BY position
			),
			'[]'::jsonb
		)
		FROM jsonb_array_elements(
			CASE
				WHEN jsonb_array_length("attachments"::jsonb) > 0 THEN "attachments"::jsonb
				WHEN jsonb_typeof("metadata"::jsonb -> 'attachments') = 'array' THEN "metadata"::jsonb -> 'attachments'
				ELSE '[]'::jsonb
			END
		) WITH ORDINALITY AS elements(attachment, position)
		WHERE jsonb_typeof(attachment) = 'object'
			AND (attachment ->> 'assetId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
			AND jsonb_typeof(attachment -> 'title') = 'string'
			AND attachment ->> 'title' <> ''
			AND jsonb_typeof(attachment -> 'fileType') = 'string'
			AND attachment ->> 'fileType' <> ''
			AND CASE
				WHEN jsonb_typeof(attachment -> 'size') = 'number' THEN (attachment ->> 'size')::numeric >= 0
					AND (attachment ->> 'size')::numeric = trunc((attachment ->> 'size')::numeric)
				ELSE false
			END
	)::json,
	"metadata" = ("metadata"::jsonb - 'attachments')::json
WHERE jsonb_array_length("attachments"::jsonb) > 0 OR "metadata"::jsonb ? 'attachments';
