import {
	quotaStatusInputSchema,
	quotaStatusResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const quotaContracts = {
	status: base
		.meta(
			openapi({
				method: "GET",
				path: "/quota/status",
				summary: "Get the quota pool covering the user for a model",
				tags: [
					"Quota pools",
				],
			}),
		)
		.input(quotaStatusInputSchema)
		.output(quotaStatusResponseSchema),
};
