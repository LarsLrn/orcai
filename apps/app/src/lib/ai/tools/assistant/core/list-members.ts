import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { runAssistantTool } from "@/lib/ai/tools/tool-error";
import { userProcedures } from "@/lib/orpc/router/user";
import {
	type AssistantToolDeps,
	assistantTool,
	callProcedure,
} from "../procedure-tool";
import { listLimitSchema } from "./list-input";

export const listMembersInputSchema = z.object({
	query: z
		.string()
		.trim()
		.max(100)
		.optional()
		.describe("Part of the name or email to search for, case-insensitive."),
	limit: listLimitSchema,
});

export const listMembersTool = (deps: AssistantToolDeps) =>
	assistantTool({
		description:
			"List the members of the active organisation with their names, emails and organisation roles.",
		inputSchema: listMembersInputSchema,
		execute: ({ query, limit }, { abortSignal }) =>
			runAssistantTool(
				callProcedure(deps, (options) =>
					userProcedures.list(
						{
							pageSize: limit,
							filters: {
								search: query,
							},
						},
						options,
					),
				).pipe(
					Effect.map(({ data, rowCount }) => ({
						members: data.map((user) => ({
							type: "member" as const,
							id: user.id,
							name: user.name,
							email: user.email,
							organizationRole: user.organizationRole,
						})),
						total: rowCount,
					})),
				),
				abortSignal,
			),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: output,
		}),
	});
