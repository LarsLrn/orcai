import { z } from "zod/v4";
import { providerSelectSchema } from "../schemas/provider";
import { base } from "./base";

export const listProvidersContract = base
	.route({
		method: "GET",
		path: "/providers",
		summary: "List all available providers",
		tags: ["Providers"],
	})
	.output(
		z.object({
			data: z.array(providerSelectSchema),
		}),
	);

export const findProviderContract = base
	.route({
		method: "GET",
		path: "/providers/{slug}",
		summary: "Find a provider of an organization",
		tags: ["Organization Providers"],
	})
	.input(
		providerSelectSchema.pick({
			slug: true,
		}),
	)
	.output(z.object({ data: providerSelectSchema }));
