import {
	quotaStatusInputSchema,
	quotaStatusResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Quota pools",
		],
	}),
);

export const quotaContracts = {
	status: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/quota/status",
				summary: "Get the quota pool covering the user for a model",
			}),
		)
		.input(quotaStatusInputSchema)
		.output(quotaStatusResponseSchema),
};
