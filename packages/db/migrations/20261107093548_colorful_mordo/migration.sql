ALTER TABLE "quota_pool" DROP CONSTRAINT "quota_pool_model_id_model_id_fkey";--> statement-breakpoint
ALTER TABLE "model" ADD CONSTRAINT "model_provider_id_id_unique" UNIQUE("provider_id","id");--> statement-breakpoint
ALTER TABLE "quota_pool" ADD CONSTRAINT "quota_pool_provider_model_fk" FOREIGN KEY ("provider_id","model_id") REFERENCES "model"("provider_id","id") ON DELETE SET NULL ("model_id");