-- Stored generation parameters cannot be told apart from untouched defaults, so every chat returns to the provider's defaults.
UPDATE "chat"
SET "config" = ("config"::jsonb - 'temperature' - 'topP' - 'frequencyPenalty' - 'presencePenalty')::json
WHERE "config"::jsonb ?| array['temperature', 'topP', 'frequencyPenalty', 'presencePenalty'];
