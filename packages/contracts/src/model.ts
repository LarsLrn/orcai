import {
	createModelInputSchema,
	createModelResponseSchema,
	deleteModelsInputSchema,
	deleteModelsResponseSchema,
	discoverModelsInputSchema,
	discoverModelsResponseSchema,
	findModelInputSchema,
	findModelResponseSchema,
	listModelsInputSchema,
	listModelsResponseSchema,
	updateModelInputSchema,
	updateModelResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Models",
		],
	}),
);

export const modelContracts = {
	list: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/models/list",
				summary: "List all available models",
			}),
		)
		.input(listModelsInputSchema)
		.output(listModelsResponseSchema),
	create: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/models",
				summary: "Create a new model",
			}),
		)
		.input(createModelInputSchema)
		.output(createModelResponseSchema),
	find: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/models/{id}",
				summary: "Find a model",
			}),
		)
		.input(findModelInputSchema)
		.output(findModelResponseSchema),
	update: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/models/{id}",
				summary: "Update a model",
			}),
		)
		.input(updateModelInputSchema)
		.output(updateModelResponseSchema),
	delete: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/models",
				summary: "Delete models",
			}),
		)
		.input(deleteModelsInputSchema)
		.output(deleteModelsResponseSchema),
	discover: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/models/{providerId}/discover",
				summary:
					"Automatically discover and add/update all available models for a given provider",
			}),
		)
		.input(discoverModelsInputSchema)
		.output(discoverModelsResponseSchema),
};
