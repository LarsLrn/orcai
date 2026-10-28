import {
	findInstanceHealthInputSchema,
	findInstanceHealthResponseSchema,
	sendTestEmailInputSchema,
	sendTestEmailResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const healthContracts = {
	instance: base
		.meta(
			openapi({
				method: "GET",
				path: "/health/instance",
				summary: "Check the instance's dependencies, processes and mail",
				tags: [
					"Health",
				],
				description: "Probes every dependency on each call.",
			}),
		)
		.input(findInstanceHealthInputSchema)
		.output(findInstanceHealthResponseSchema),
	sendTestEmail: base
		.meta(
			openapi({
				method: "POST",
				path: "/health/test-email",
				summary: "Send a test email to the signed-in instance administrator",
				tags: [
					"Health",
				],
			}),
		)
		.input(sendTestEmailInputSchema)
		.output(sendTestEmailResponseSchema),
};
