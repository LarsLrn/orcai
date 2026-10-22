import {
	findLatestDataExportInputSchema,
	findLatestDataExportResponseSchema,
	requestDataExportInputSchema,
	requestDataExportResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const dataExportContracts = {
	latest: base
		.meta(
			openapi({
				method: "GET",
				path: "/data-exports/latest",
				summary: "Get the signed-in user's newest data export",
				tags: [
					"Data exports",
				],
			}),
		)
		.input(findLatestDataExportInputSchema)
		.output(findLatestDataExportResponseSchema),
	request: base
		.meta(
			openapi({
				method: "POST",
				path: "/data-exports",
				summary: "Request an export of the signed-in user's data",
				tags: [
					"Data exports",
				],
				description:
					"Builds a zip archive in the background. One export runs per user at a time.",
			}),
		)
		.input(requestDataExportInputSchema)
		.output(requestDataExportResponseSchema),
};
