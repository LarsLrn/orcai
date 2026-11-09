import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { listPage, listPaging, PAGING_NOTE } from "../list-input";
import { type AssistantToolDeps, callProcedure } from "../procedure-tool";
import { findPeopleInputSchema } from "./find-people.declaration";
import { expectTarget, toResourceIdentity } from "./resource-target";

export const findPeopleTool = (deps: AssistantToolDeps) =>
	effectTool({
		description: `Find the users and groups of the active organisation that could be given access to a bot, block or asset, by name: users sorted by name, then groups. Use it to resolve names to ids before grantAccess. The user needs Can manage on the item. ${PAGING_NOTE}`,
		inputSchema: findPeopleInputSchema,
		run: ({ granteeType, query, excludeGranted, page, ...target }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.resource.listPrincipals(
					{
						...toResourceIdentity(target),
						principalType: granteeType,
						query,
						excludeGranted,
						...listPage(page),
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
					...listPaging(page, rowCount),
				})),
			),
	});
