import { z } from "zod/v4";
import {
	modelDeleteSchema,
	modelInsertSchema,
	modelSelectSchema,
	modelUpdateSchema,
} from "@/lib/orpc/schemas/model";
import { providerSelectSchema } from "@/lib/orpc/schemas/provider";
import { paginationSchema, statusSchema } from "@/lib/orpc/schemas/shared";
import { base } from "./base";

export const listModelsContract = base
	.route({
		method: "POST",
		path: "/models",
		summary: "List all available models",
		tags: ["Models"],
	})
	.input(
		z.object({
			filters: z
				.object({
					providerId: providerSelectSchema.shape.id.optional(),
					capabilities: modelSelectSchema.shape.capabilities.optional(),
				})
				.optional(),
			...paginationSchema.shape,
		}),
	)
	.output(
		z.object({
			data: z.array(modelSelectSchema),
			rowCount: z.number(),
		}),
	);

export const createModelContract = base
	.route({
		method: "POST",
		path: "/models",
		summary: "Create a new model",
		tags: ["Models"],
	})
	.input(modelInsertSchema)
	.output(
		z.object({
			data: modelSelectSchema,
		}),
	);

export const findModelContract = base
	.route({
		method: "GET",
		path: "/models/{id}",
		summary: "Find a model",
		tags: ["Models"],
	})
	.input(
		modelSelectSchema.pick({
			id: true,
		}),
	)
	.output(
		z.object({
			data: modelSelectSchema,
		}),
	);

export const updateModelContract = base
	.route({
		method: "PUT",
		path: "/models/{id}",
		summary: "Update a model",
		tags: ["Models"],
	})
	.input(modelUpdateSchema)
	.output(
		z.object({
			data: modelSelectSchema,
		}),
	);

export const deleteModelContract = base
	.route({
		method: "DELETE",
		path: "/models",
		summary: "Delete models",
		tags: ["Models"],
	})
	.input(modelDeleteSchema)
	.output(statusSchema);

export const discoverModelsContract = base
	.route({
		method: "POST",
		path: "/models/{providerId}/discover",
		summary:
			"Automatically discover and add/update all available models for a given provider",
		tags: ["Models"],
	})
	.input(
		z.object({
			providerId: providerSelectSchema.shape.id,
		}),
	)
	.output(
		z.object({
			data: z.object({
				foundCount: z.number().int().nonnegative(),
				addedCount: z.number().int().nonnegative(),
				alreadyExistedCount: z.number().int().nonnegative(),
			}),
		}),
	);
