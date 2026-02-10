import {
	boolean,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organization } from "./organization";

export type Compatibility = "openai" | "anthropic" | "google" | "azure";

export const provider = pgTable("provider", {
	slug: text("slug").notNull().unique().primaryKey(),
	name: text("name").notNull(),
	description: varchar("description", { length: 500 }).notNull(),
	website: text("website").notNull(),
	compatibility: text("compatibility").notNull().$type<Compatibility>(),
	endpoint: text("endpoint"),
	version: integer("version").notNull().default(1),
	createdAt: timestamp("created_at").defaultNow(),
});

export const model = pgTable(
	"model",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		slug: text("slug").notNull(),
		providerSlug: text("provider_slug")
			.notNull()
			.references(() => provider.slug, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: varchar("description", { length: 500 }).notNull(),
		isDeprecated: boolean("is_deprecated").notNull().default(false),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(table) => [unique().on(table.slug, table.providerSlug)],
);

export const capability = pgTable("capability", {
	capability: text("capability").notNull().unique().primaryKey(),
	name: text("name").notNull(),
	description: varchar("description", { length: 500 }).notNull(),
});

export const modelCapability = pgTable(
	"model_capability",
	{
		modelId: uuid("model_id")
			.notNull()
			.references(() => model.id, { onDelete: "cascade" }),
		capability: text("capability")
			.notNull()
			.references(() => capability.capability, { onDelete: "cascade" }),
	},
	(table) => [unique().on(table.modelId, table.capability)],
);

export const organizationProvider = pgTable(
	"organization_provider",
	{
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		providerSlug: text("provider_slug")
			.notNull()
			.references(() => provider.slug, { onDelete: "cascade" }),
		apiKeyEncrypted: text("api_key_encrypted").notNull(),
		enabled: boolean("enabled").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [unique().on(table.organizationId, table.providerSlug)],
);
