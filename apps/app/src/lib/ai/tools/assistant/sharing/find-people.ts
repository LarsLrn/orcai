import { resourceListPrincipalsInputSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { listLimitSchema } from "../core/list-input";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";
import {
	expectTarget,
	targetShape,
	toResourceIdentity,
} from "./resource-target";

const principalFilters = resourceListPrincipalsInputSchema.options[0].shape;

const findPeopleInputSchema = z.strictObject({
	...targetShape,
	granteeType: principalFilters.principalType.describe(
		"Only users or only groups; leave out for both.",
	),
	query: principalFilters.query.describe(
		"Part of the name (or a user's email) to search for, case-insensitive.",
	),
	excludeGranted: principalFilters.excludeGranted.describe(
		"Leave out users and groups that already hold a direct grant.",
	),
	limit: listLimitSchema,
});

export const findPeopleTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Find the users and groups that could be given access to a bot, block or asset, by name. Use it to resolve names to ids before grantAccess. Needs manage access on the resource.",
		inputSchema: findPeopleInputSchema,
		run: ({ granteeType, query, excludeGranted, limit, ...target }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.resource.listPrincipals(
					{
						...toResourceIdentity(target),
						principalType: granteeType,
						query,
						excludeGranted,
						limit,
					},
					options,
				),
			).pipe(
				expectTarget(target),
				Effect.map(({ data, rowCount }) => ({
					grantees: data.map((principal) =>
						principal.type === "user"
							? {
									granteeType: principal.type,
									granteeId: principal.id,
									name: principal.name,
									email: principal.email,
								}
							: {
									granteeType: principal.type,
									granteeId: principal.id,
									name: principal.name,
									description: principal.description,
									kind: principal.kind,
								},
					),
					count: rowCount,
				})),
			),
	});
