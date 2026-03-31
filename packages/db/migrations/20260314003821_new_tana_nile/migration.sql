CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "model_name_trgm_idx" ON "model" USING gin ("name" gin_trgm_ops);