-- One pending invitation per address and organization: the one that lasts longest stays open, and the closed ones' undelivered emails go.
WITH closed AS (
	UPDATE "invitation" SET "status" = 'rejected', "updated_at" = now()
	WHERE "status" = 'pending' AND "id" NOT IN (
		SELECT DISTINCT ON ("organization_id", lower(trim("email"))) "id"
		FROM "invitation"
		WHERE "status" = 'pending'
		ORDER BY "organization_id", lower(trim("email")), "expires_at" DESC, "created_at" DESC NULLS LAST, "id"
	)
	RETURNING "id"
)
DELETE FROM "notification_outbox"
WHERE "status" IN ('pending', 'processing') AND "deduplication_key" IN (SELECT 'organization.invited:' || "id" FROM closed);--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_org_pending_email_unique" ON "invitation" ("organization_id",lower(trim("email"))) WHERE "status" = 'pending';
