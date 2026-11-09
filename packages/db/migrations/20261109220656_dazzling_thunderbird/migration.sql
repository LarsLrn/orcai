UPDATE "block"
SET "config" = ("config"::jsonb - 'scoreThreshold')::json
WHERE jsonb_typeof("config"::jsonb) = 'object' AND "config"::jsonb ? 'scoreThreshold';
