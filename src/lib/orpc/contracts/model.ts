import { z } from "zod/v4";
import {
	modelDeleteSchema,
	modelInsertSchema,
	modelSelectSchema,
	modelUpdateSchema,
} from "@/lib/orpc/schemas/model";
import { paginationSchema, statusSchema } from "../schemas/shared";
import { base } from "./base";

export const listModelsContract = base
	.route({
		method: "POST",
		path: "/models",
		summary: "List all available models",
		tags: ["Models"],
	})
	.input(paginationSchema)
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
