import { z } from "zod/v4";
import {
	providerDeleteSchema,
	providerInsertSchema,
	providerSelectSchema,
	providerUpdateSchema,
} from "@/lib/orpc/schemas/provider";
import { paginationSchema, statusSchema } from "@/lib/orpc/schemas/shared";
import { base } from "./base";

export const listProvidersContract = base
	.route({
		method: "GET",
		path: "/providers",
		summary: "List all providers",
		tags: ["Providers"],
	})
	.input(paginationSchema)
	.output(
		z.object({
			data: z.array(providerSelectSchema),
			rowCount: z.number(),
		}),
	);

export const createProviderContract = base
	.route({
		method: "POST",
		path: "/providers",
		summary: "Create a provider",
		tags: ["Providers"],
	})
	.input(providerInsertSchema)
	.output(z.object({ data: providerSelectSchema }));

export const findProviderContract = base
	.route({
		method: "GET",
		path: "/providers/{id}",
		summary: "Find a provider",
		tags: ["Providers"],
	})
	.input(
		providerSelectSchema.pick({
			id: true,
		}),
	)
	.output(z.object({ data: providerSelectSchema }));

export const updateProviderContract = base
	.route({
		method: "PUT",
		path: "/providers/{id}",
		summary: "Update a provider",
		tags: ["Providers"],
	})
	.input(providerUpdateSchema)
	.output(z.object({ data: providerSelectSchema }));

export const deleteProviderContract = base
	.route({
		method: "DELETE",
		path: "/providers",
		summary: "Delete providers",
		tags: ["Providers"],
	})
	.input(providerDeleteSchema)
	.output(statusSchema);
