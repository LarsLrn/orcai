CREATE INDEX "block_asset_asset_idx" ON "block_asset" ("asset_id","block_id");--> statement-breakpoint
CREATE INDEX "chat_block_chat_idx" ON "chat_block" ("chat_id","block_id");--> statement-breakpoint
CREATE INDEX "bot_block_bot_idx" ON "bot_block" ("bot_id","block_id");--> statement-breakpoint
CREATE INDEX "member_user_org_idx" ON "member" ("user_id","organization_id");