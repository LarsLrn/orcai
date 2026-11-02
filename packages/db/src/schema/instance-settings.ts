import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	bigint,
	boolean,
	check,
	integer,
	pgSchema,
	pgSequence,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const embeddingGenerationSequence = pgSequence(
	"embedding_generation_seq",
);

const embeddingColumns = [
	"embedding_generation",
	"embedding_base_url",
	"embedding_api_key_encrypted",
	"embedding_model",
	"embedding_dimensions",
	"embedding_collection",
];

const columns = () => ({
	id: boolean("id").primaryKey().default(true),
	/**
	 * The active embedding generation: its endpoint, model and collection.
	 * A new model gets a new generation; null until embeddings are set up.
	 */
	embeddingGeneration: bigint("embedding_generation", {
		mode: "number",
	}),
	embeddingBaseUrl: text("embedding_base_url"),
	embeddingApiKeyEncrypted: text("embedding_api_key_encrypted"),
	embeddingModel: text("embedding_model"),
	embeddingDimensions: integer("embedding_dimensions"),
	embeddingCollection: text("embedding_collection"),
	/** Files are re-embedded into the active generation until every one has settled. */
	embeddingRebuilding: boolean("embedding_rebuilding").notNull().default(false),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

const constraints = (table: { readonly id: AnyPgColumn }) => [
	check("instance_settings_singleton", sql`${table.id}`),
	check(
		"instance_settings_embedding_complete",
		sql.raw(
			`(${embeddingColumns.map((column) => `${column} is null`).join(" and ")}) or (${embeddingColumns.map((column) => `${column} is not null`).join(" and ")})`,
		),
	),
];

/** The instance's settings: one row, a column per setting. */
export const instanceSettings = pgTable(
	"instance_settings",
	columns(),
	constraints,
);

/** The same table in `schema`, for a test that needs an instance of its own. */
export const instanceSettingsIn = (schema: string) =>
	pgSchema(schema).table("instance_settings", columns(), constraints);
