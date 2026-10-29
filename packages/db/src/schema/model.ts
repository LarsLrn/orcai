import type {
	ModelId,
	OrganizationId,
	ProviderId,
	ProviderKind,
} from "@orcai/core";
import type { ModelCapability } from "@orcai/schema";
import { sql } from "drizzle-orm";
import {
	boolean,
	char,
	index,
	integer,
	numeric,
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

const price = (name: string) =>
	numeric(name, {
		mode: "number",
	});

export const model = pgTable(
	"model",
	{
		id: uuid("id").$type<ModelId>().primaryKey().defaultRandom(),
		providerId: uuid("provider_id")
			.$type<ProviderId>()
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
		/** Null until the provider reports them or an admin sets them. */
		capabilities: text("capability").$type<ModelCapability>().array(),
		contextWindow: integer("context_window"),
		maxOutputTokens: integer("max_output_tokens"),
		/** Per 1M tokens, in the provider's currency. */
		inputPrice: price("input_price"),
		cacheReadPrice: price("cache_read_price"),
		cacheWritePrice: price("cache_write_price"),
		outputPrice: price("output_price"),
		requestPrice: price("request_price"),
		webSearchPrice: price("web_search_price"),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
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
		id: uuid("id").$type<ProviderId>().primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.$type<OrganizationId>()
			.notNull()
			.references(() => organization.id, {
				onDelete: "cascade",
			}),
		name: text("name").notNull(),
		kind: text("kind").notNull().$type<ProviderKind>(),
		description: varchar("description", {
			length: 500,
		}).notNull(),
		endpoint: text("endpoint"),
		apiKeyEncrypted: text("api_key_encrypted").notNull(),
		meteringMode: providerMeteringModeEnum("metering_mode")
			.notNull()
			.default("tokens"),
		/** ISO 4217; the currency of its prices. */
		currency: char("currency", {
			length: 3,
		})
			.notNull()
			.default("USD"),
		/** Its responses carry their cost, OpenRouter style. */
		reportsCost: boolean("reports_cost").notNull().default(false),
		/** A search provider's price per search. */
		searchPrice: price("search_price"),
		enabled: boolean("enabled").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("provider_organization_idx").on(table.organizationId),
	],
);
