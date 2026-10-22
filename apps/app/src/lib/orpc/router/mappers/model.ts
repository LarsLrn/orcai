import type { dbSchema } from "@orcai/db/schema";
import type {
	CreateModelInput,
	Model,
	ModelListRow,
	ModelPrices,
	UpdateModelInput,
} from "@orcai/schema";

type ModelRow = typeof dbSchema.model.$inferSelect;
type ModelInsertValues = typeof dbSchema.model.$inferInsert;

/** The price columns of the prices given; a price left out stays undefined. */
const priceValues = (prices: Partial<ModelPrices> = {}) => ({
	inputPrice: prices.input,
	cacheReadPrice: prices.cacheRead,
	cacheWritePrice: prices.cacheWrite,
	outputPrice: prices.output,
	requestPrice: prices.request,
	webSearchPrice: prices.webSearch,
});

export function toModelDto(row: ModelRow): Model {
	return {
		id: row.id,
		providerId: row.providerId,
		providerModelId: row.providerModelId,
		name: row.name,
		description: row.description,
		isDeprecated: row.isDeprecated,
		capabilities: row.capabilities,
		contextWindow: row.contextWindow,
		maxOutputTokens: row.maxOutputTokens,
		prices: {
			input: row.inputPrice,
			cacheRead: row.cacheReadPrice,
			cacheWrite: row.cacheWritePrice,
			output: row.outputPrice,
			request: row.requestPrice,
			webSearch: row.webSearchPrice,
		},
		createdAt: row.createdAt ?? null,
		updatedAt: row.updatedAt ?? null,
	};
}

export function toModelListRowDto(
	row: ModelRow,
	provider: Pick<ModelListRow["provider"], "id" | "name">,
): ModelListRow {
	return {
		...toModelDto(row),
		provider,
	};
}

export function mapCreateModelInputToModelInsertValues(
	input: CreateModelInput,
): ModelInsertValues {
	return {
		providerId: input.providerId,
		providerModelId: input.providerModelId,
		name: input.name,
		description: input.description,
		isDeprecated: input.isDeprecated,
		capabilities: input.capabilities,
		contextWindow: input.contextWindow ?? null,
		maxOutputTokens: input.maxOutputTokens ?? null,
		...priceValues(input.prices),
	};
}

export function mapUpdateModelInputToModelUpdateValues(
	input: UpdateModelInput,
): Partial<ModelInsertValues> {
	return {
		providerId: input.providerId,
		providerModelId: input.providerModelId,
		name: input.name,
		description: input.description,
		isDeprecated: input.isDeprecated,
		capabilities: input.capabilities,
		contextWindow: input.contextWindow,
		maxOutputTokens: input.maxOutputTokens,
		...priceValues(input.prices),
		updatedAt: new Date(),
	};
}
