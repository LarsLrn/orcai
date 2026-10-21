import type { dbSchema } from "@orcai/db/schema";
import type {
	CreateModelInput,
	Model,
	ModelListRow,
	UpdateModelInput,
} from "@orcai/schema";

type ModelRow = typeof dbSchema.model.$inferSelect;
type ModelInsertValues = typeof dbSchema.model.$inferInsert;

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
		updatedAt: new Date(),
	};
}
