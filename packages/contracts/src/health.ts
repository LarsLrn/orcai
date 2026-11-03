import {
	findInstanceHealthInputSchema,
	findInstanceHealthResponseSchema,
	sendTestEmailInputSchema,
	sendTestEmailResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Health",
		],
	}),
);

export const healthContracts = {
	instance: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/health/instance",
				summary: "Check the instance's dependencies, processes and mail",
				description: "Probes every dependency on each call.",
			}),
		)
		.input(findInstanceHealthInputSchema)
		.output(findInstanceHealthResponseSchema),
	sendTestEmail: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/health/test-email",
				summary: "Send a test email to the signed-in instance admin",
			}),
		)
		.input(sendTestEmailInputSchema)
		.output(sendTestEmailResponseSchema),
};
