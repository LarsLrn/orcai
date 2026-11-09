import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { listPage, listPaging, PAGING_NOTE } from "../list-input";
import {
	type AssistantToolDeps,
	callProcedure,
	expectType,
} from "../procedure-tool";
import { listGroupMembersInputSchema } from "./list-group-members.declaration";

export const listGroupMembersTool = (deps: AssistantToolDeps) =>
	effectTool({
		description: `List the members of a group, sorted by name. The All members group holds every member of the organisation, with source implicit. ${PAGING_NOTE}`,
		inputSchema: listGroupMembersInputSchema,
		run: ({ groupId, query, page }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.group.listMembers(
					{
						groupId,
						query,
						...listPage(page),
					},
					options,
				),
			).pipe(
				expectType("group", groupId),
				Effect.map(({ data, rowCount }) => ({
					members: data.map((row) => ({
						id: row.user.id,
						name: row.user.name,
						email: row.user.email,
						source: row.source,
					})),
					...listPaging(page, rowCount),
				})),
			),
	});
