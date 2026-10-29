import {
	activityAttentionInputSchema,
	activityAttentionResponseSchema,
	activitySummaryInputSchema,
	activitySummaryResponseSchema,
	dismissActivityFailureInputSchema,
	dismissActivityRunInputSchema,
	listActivityMembersInputSchema,
	listActivityMembersResponseSchema,
	listActivityRunsInputSchema,
	listActivityRunsResponseSchema,
	statusResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tags = [
	"Activity",
];

export const activityContracts = {
	summary: base
		.meta(
			openapi({
				method: "GET",
				path: "/activity/summary",
				summary:
					"Get the signed-in user's running work and how much needs their attention",
				tags,
			}),
		)
		.input(activitySummaryInputSchema)
		.output(activitySummaryResponseSchema),
	runs: base
		.meta(
			openapi({
				method: "GET",
				path: "/activity/runs",
				summary: "List the signed-in user's running and recent work",
				tags,
			}),
		)
		.input(listActivityRunsInputSchema)
		.output(listActivityRunsResponseSchema),
	attention: base
		.meta(
			openapi({
				method: "GET",
				path: "/activity/attention",
				summary:
					"List the failures and suggestions that need the signed-in user",
				tags,
			}),
		)
		.input(activityAttentionInputSchema)
		.output(activityAttentionResponseSchema),
	runMembers: base
		.meta(
			openapi({
				method: "GET",
				path: "/activity/runs/{runId}/members",
				summary: "List the assets of one of the signed-in user's runs",
				tags,
			}),
		)
		.input(listActivityMembersInputSchema)
		.output(listActivityMembersResponseSchema),
	dismissRun: base
		.meta(
			openapi({
				method: "POST",
				path: "/activity/runs/{runId}/dismiss",
				summary: "Hide a finished run from the signed-in user's activity",
				tags,
			}),
		)
		.input(dismissActivityRunInputSchema)
		.output(statusResponseSchema),
	dismissFailure: base
		.meta(
			openapi({
				method: "POST",
				path: "/activity/failures/{occurrenceId}/dismiss",
				summary: "Hide one failure from the signed-in user's attention list",
				tags,
			}),
		)
		.input(dismissActivityFailureInputSchema)
		.output(statusResponseSchema),
};
