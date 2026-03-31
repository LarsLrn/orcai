import type { ModelCapability, ProviderCompatibility } from "@orcai/schema";
import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organization } from "./organization";

export const providerMeteringModeEnum = pgEnum("provider_metering_mode", [
	"tokens",
	"requests",
]);

export const model = pgTable(
	"model",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		providerId: uuid("provider_id")
			.notNull()
			.references(() => provider.id, {
				onDelete: "cascade",
			}),
		providerModelId: text("provider_model_id").notNull(),
		name: text("name").notNull(),
		description: varchar("description", {
			length: 500,
		}).notNull(),
		isDeprecated: boolean("is_deprecated").notNull().default(false),
		capabilities: text("capability").$type<ModelCapability>().array().notNull(),
		createdAt: timestamp("created_at").defaultNow(),
		// TODO: Add updatedAt field and trigger to update it on change
	},
	(table) => [
		unique("provider_model_id_provider_id_unique").on(
			table.providerModelId,
			table.providerId,
		),
		index("model_name_trgm_idx").using("gin", sql`${table.name} gin_trgm_ops`),
	],
);

export const provider = pgTable(
	"provider",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, {
				onDelete: "cascade",
			}),
		name: text("name").notNull(),
		compatibility: text("compatibility")
			.notNull()
			.$type<ProviderCompatibility>(),
		description: varchar("description", {
			length: 500,
		}).notNull(),
		endpoint: text("endpoint").notNull(),
		apiKeyEncrypted: text("api_key_encrypted").notNull(),
		meteringMode: providerMeteringModeEnum("metering_mode")
			.notNull()
			.default("tokens"),
		enabled: boolean("enabled").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("provider_organization_idx").on(table.organizationId),
	],
);
