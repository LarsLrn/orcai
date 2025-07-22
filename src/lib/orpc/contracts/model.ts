import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { capabilityTable, modelTable } from "@/db/schema/model";
import { base } from "./base";

export const modelSelectSchema = createSelectSchema(modelTable);
export const capabilitySelectSchema = createSelectSchema(capabilityTable);

export const listModelsContract = base
	.route({
		method: "GET",
		path: "/models",
		summary: "List all available models",
		tags: ["Models"],
	})
	.input(modelSelectSchema.pick({ providerSlug: true }))
	.output(
		z.object({
			data: z.array(
				modelSelectSchema.extend({
					capabilities: z.array(capabilitySelectSchema),
				}),
			),
		}),
	);

export const findModelContract = base
	.route({
		method: "GET",
		path: "/models/{slug}",
		summary: "Find a model by its slug",
		tags: ["Models"],
	})
	.input(
		modelSelectSchema.pick({
			slug: true,
			providerSlug: true,
		}),
	)
	.output(
		z.object({
			data: modelSelectSchema.extend({
				capabilities: z.array(capabilitySelectSchema),
			}),
		}),
	);
