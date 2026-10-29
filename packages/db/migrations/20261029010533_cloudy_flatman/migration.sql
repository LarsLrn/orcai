ALTER TABLE "resource_grant" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
DROP INDEX "resource_grant_active_principal_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "resource_grant_active_principal_unique" ON "resource_grant" ("resource_type","resource_id","principal_type","principal_id","organization_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "resource_grant_organization_idx" ON "resource_grant" ("organization_id");--> statement-breakpoint
ALTER TABLE "resource_grant" ADD CONSTRAINT "resource_grant_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;