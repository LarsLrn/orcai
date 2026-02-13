import {
	boolean,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import type { ModelCapability } from "@/lib/orpc/schemas/model";
import type { ProviderCompatibility } from "@/lib/orpc/schemas/provider";

export const model = pgTable("model", {
	id: uuid("id").primaryKey().defaultRandom(),
	providerId: uuid("provider_id")
		.notNull()
		.references(() => provider.id, { onDelete: "cascade" }),
	providerModelId: text("provider_model_id").notNull(),
	name: text("name").notNull(),
	description: varchar("description", { length: 500 }).notNull(),
	isDeprecated: boolean("is_deprecated").notNull().default(false),
	capabilities: text("capability").$type<ModelCapability>().array().notNull(),
	createdAt: timestamp("created_at").defaultNow(),
	// TODO: Add updatedAt field and trigger to update it on change
});

export const provider = pgTable("provider", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	compatibility: text("compatibility").notNull().$type<ProviderCompatibility>(),
	description: varchar("description", { length: 500 }).notNull(),
	endpoint: text("endpoint").notNull(),
	apiKeyEncrypted: text("api_key_encrypted").notNull(),
	enabled: boolean("enabled").notNull().default(true),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});
