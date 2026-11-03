import {
	findLatestDataExportInputSchema,
	findLatestDataExportResponseSchema,
	requestDataExportInputSchema,
	requestDataExportResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Data exports",
		],
	}),
);

export const dataExportContracts = {
	latest: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/data-exports/latest",
				summary: "Get the signed-in user's newest data export",
			}),
		)
		.input(findLatestDataExportInputSchema)
		.output(findLatestDataExportResponseSchema),
	request: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/data-exports",
				summary: "Request an export of the signed-in user's data",
				description:
					"Builds a zip archive in the background. One export runs per user at a time.",
			}),
		)
		.input(requestDataExportInputSchema)
		.output(requestDataExportResponseSchema),
};
