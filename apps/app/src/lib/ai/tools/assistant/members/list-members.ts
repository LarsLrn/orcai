import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { listPage, listPaging, PAGING_NOTE } from "../list-input";
import { type AssistantToolDeps, callProcedure } from "../procedure-tool";
import { listMembersInputSchema } from "./list-members.declaration";

export const listMembersTool = (deps: AssistantToolDeps) =>
	effectTool({
		description: `List the members of the active organisation with their names, emails and organisation roles, newest first. Use it to find the user id the people tools take. ${PAGING_NOTE}`,
		inputSchema: listMembersInputSchema,
		run: ({ query, page }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.organizationMember.list(
					{
						...listPage(page),
						filters: {
							search: query,
						},
					},
					options,
				),
			).pipe(
				Effect.map(({ data, rowCount }) => ({
					members: data.map((user) => ({
						id: user.id,
						name: user.name,
						email: user.email,
						organizationRole: user.organizationRole,
					})),
					...listPaging(page, rowCount),
				})),
			),
	});
