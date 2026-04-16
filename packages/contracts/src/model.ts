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
import { base } from "./base";

export const modelContracts = {
	list: base
		.route({
			method: "POST",
			path: "/models/list",
			summary: "List all available models",
			tags: [
				"Models",
			],
		})
		.input(listModelsInputSchema)
		.output(listModelsResponseSchema),
	create: base
		.route({
			method: "POST",
			path: "/models",
			summary: "Create a new model",
			tags: [
				"Models",
			],
		})
		.input(createModelInputSchema)
		.output(createModelResponseSchema),
	find: base
		.route({
			method: "GET",
			path: "/models/{id}",
			summary: "Find a model",
			tags: [
				"Models",
			],
		})
		.input(findModelInputSchema)
		.output(findModelResponseSchema),
	update: base
		.route({
			method: "PUT",
			path: "/models/{id}",
			summary: "Update a model",
			tags: [
				"Models",
			],
		})
		.input(updateModelInputSchema)
		.output(updateModelResponseSchema),
	delete: base
		.route({
			method: "DELETE",
			path: "/models",
			summary: "Delete models",
			tags: [
				"Models",
			],
		})
		.input(deleteModelsInputSchema)
		.output(deleteModelsResponseSchema),
	discover: base
		.route({
			method: "POST",
			path: "/models/{providerId}/discover",
			summary:
				"Automatically discover and add/update all available models for a given provider",
			tags: [
				"Models",
			],
		})
		.input(discoverModelsInputSchema)
		.output(discoverModelsResponseSchema),
};
