import type {
	BlockId,
	BotId,
	ModelId,
	OrganizationId,
	UserId,
} from "@orcai/core";
import type {
	Features,
	GenerationSettings,
	PublicationStatus,
} from "@orcai/schema";
import {
	type AnyPgColumn,
	index,
	integer,
	json,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { block } from "./block";
import { model } from "./model";
import { organization } from "./organization";

export const bot = pgTable("bot", {
	id: uuid("id").$type<BotId>().primaryKey().defaultRandom(),
	name: text("name").notNull(),
	description: varchar("description", {
		length: 500,
	}).notNull(),
	contentJson: json("content_json").notNull().default({}),
	status: text("status").$type<PublicationStatus>().notNull().default("ready"),
	userId: uuid("user_id")
		.$type<UserId>()
		.notNull()
		.references(() => user.id),
	forkedFromId: uuid("forked_from_id")
		.$type<BotId>()
		.references((): AnyPgColumn => bot.id, {
			onDelete: "set null",
		}),
	version: integer("version").notNull().default(1),
	features: json("features").$type<Features>().notNull().default({}),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

export const botBlock = pgTable(
	"bot_block",
	{
		blockId: uuid("block_id")
			.$type<BlockId>()
			.notNull()
			.references(() => block.id, {
				onDelete: "cascade",
			}),
		botId: uuid("bot_id")
			.$type<BotId>()
			.notNull()
			.references(() => bot.id, {
				onDelete: "cascade",
			}),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		primaryKey({
			columns: [
				table.blockId,
				table.botId,
			],
		}),
	],
);

export const botFavourite = pgTable(
	"bot_favourite",
	{
		userId: uuid("user_id")
			.$type<UserId>()
			.notNull()
			.references(() => user.id, {
				onDelete: "cascade",
			}),
		botId: uuid("bot_id")
			.$type<BotId>()
			.notNull()
			.references(() => bot.id, {
				onDelete: "cascade",
			}),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		primaryKey({
			columns: [
				table.userId,
				table.botId,
			],
		}),
		index("bot_favourite_bot_idx").on(table.botId),
	],
);

export const botSetupStrengthEnum = pgEnum("bot_setup_strength", [
	"recommended",
	"required",
]);

/** A bot's model and generation settings in one organisation. */
export const botSetup = pgTable(
	"bot_setup",
	{
		botId: uuid("bot_id")
			.$type<BotId>()
			.notNull()
			.references(() => bot.id, {
				onDelete: "cascade",
			}),
		organizationId: uuid("organization_id")
			.$type<OrganizationId>()
			.notNull()
			.references(() => organization.id, {
				onDelete: "cascade",
			}),
		modelId: uuid("model_id")
			.$type<ModelId>()
			.references(() => model.id, {
				onDelete: "set null",
			}),
		strength: botSetupStrengthEnum("strength").notNull(),
		generation: json("generation")
			.$type<GenerationSettings>()
			.notNull()
			.default({}),
		updatedBy: uuid("updated_by")
			.$type<UserId>()
			.references(() => user.id, {
				onDelete: "set null",
			}),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		primaryKey({
			columns: [
				table.botId,
				table.organizationId,
			],
		}),
		index("bot_setup_organization_idx").on(table.organizationId),
		index("bot_setup_model_idx").on(table.modelId),
	],
);
