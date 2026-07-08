import { z } from "zod/v4";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared";
import { modelSchema } from "./schema";
import { modelListRowSchema } from "./views";

export const listModelsResponseSchema =
	createListResponseSchema(modelListRowSchema);
export const findModelResponseSchema = createDataResponseSchema(modelSchema);
export const createModelResponseSchema = createDataResponseSchema(modelSchema);
export const updateModelResponseSchema = createDataResponseSchema(modelSchema);
export const deleteModelsResponseSchema = createDeleteResponseSchema();

export const discoverModelsResponseSchema = createDataResponseSchema(
	z.object({
		foundCount: z.number().int().nonnegative(),
		addedCount: z.number().int().nonnegative(),
		alreadyExistedCount: z.number().int().nonnegative(),
	}),
);
