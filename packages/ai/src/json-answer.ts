import type { ModelProviderKind } from "@orcai/core";
import {
	extractJsonMiddleware,
	type LanguageModel,
	wrapLanguageModel,
} from "ai";
import type { z } from "zod/v4";
import { providerKindServerEntries } from "./provider-kinds/registry";

/**
 * How to answer with `schema`'s object. Where the kind sends the schema, its
 * field descriptions reach the model with it; elsewhere they are listed here.
 */
export const jsonAnswerInstructions = (
	kind: ModelProviderKind,
	schema: z.ZodObject,
) =>
	providerKindServerEntries[kind].jsonWithoutSchema
		? [
				"Answer with one JSON object with exactly these fields, as plain JSON that starts with { and ends with }:",
				...Object.entries(schema.shape).map(
					([field, value]) => `- "${field}": ${value.description}`,
				),
			].join("\n")
		: undefined;

/** `model` with the code fence removed that models in JSON mode may put around the object. */
export const jsonAnswerModel = (model: LanguageModel): LanguageModel =>
	typeof model === "string"
		? model
		: wrapLanguageModel({
				model,
				middleware: extractJsonMiddleware(),
			});
