ALTER TABLE "chat" ADD COLUMN "config" json DEFAULT '{}';

UPDATE "block"
SET "config" = (("config")::jsonb - 'model' - 'provider')::json
WHERE "type" = 'template';
