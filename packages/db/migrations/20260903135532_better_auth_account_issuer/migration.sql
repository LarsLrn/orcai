-- Only password credentials are configured. Other providers need an explicit,
-- trusted issuer mapping before this migration can proceed.
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "account" WHERE "provider_id" <> 'credential') THEN
		RAISE EXCEPTION 'Cannot migrate Better Auth accounts: non-credential providers require an explicit issuer mapping';
	END IF;
END;
$$;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
-- Better Auth 1.7 identifies password credentials by the stable user ID.
-- Keep the existing password hashes and account row IDs.
UPDATE "account"
SET "issuer" = 'local:credential', "account_id" = "user_id"::text
WHERE "provider_id" = 'credential';--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_id_unique" ON "account" ("issuer","account_id");
