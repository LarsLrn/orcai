import { z } from "zod/v4";
import { priceSchema } from "../../shared/primitives/money";

/**
 * What the provider bills for the model, in the provider's currency; null
 * when unset. Tokens are priced per 1M; an unset cache price falls back to
 * the input price.
 */
export const modelPricesSchema = z.object({
	input: priceSchema.nullable(),
	cacheRead: priceSchema.nullable(),
	cacheWrite: priceSchema.nullable(),
	output: priceSchema.nullable(),
	request: priceSchema.nullable(),
	/** Per search with the provider's own web search tool. */
	webSearch: priceSchema.nullable(),
});

export type ModelPrices = z.infer<typeof modelPricesSchema>;
