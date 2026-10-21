import { resourceGrantRoleSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { runAssistantTool } from "@/lib/ai/tools/tool-error";
import { resourceProcedures } from "@/lib/orpc/router/resource";
import {
	type AssistantToolDeps,
	assistantTool,
	callProcedure,
	mutation,
} from "../procedure-tool";
import {
	expectPrincipals,
	expectResource,
	principalShape,
	resourceTargetShape,
	toPrincipalIdentity,
	toResourceIdentity,
} from "./resource-target";

export const grantAccessInputSchema = z.object({
	...resourceTargetShape,
	principals: z
		.array(z.object(principalShape))
		.min(1)
		.max(50)
		.describe("The users and groups that get the role."),
	role: resourceGrantRoleSchema.describe(
		"viewer reads and uses, editor also edits, manager also manages access.",
	),
});

export const grantAccessTool = (deps: AssistantToolDeps) =>
	assistantTool({
		description:
			"Give users or groups a role on one bot, block or asset; a principal that already has a role gets the new one instead. It grants on the named resource only, not on a bot's template or repositories. The user confirms before it runs. Needs manage access on the resource. Public visibility (everyone on the instance) is set only in the resource's access dialog in the editor, never by the assistant.",
		inputSchema: grantAccessInputSchema,
		execute: ({ principals, role, ...target }, { abortSignal }) =>
			runAssistantTool(
				Effect.gen(function* () {
					const resource = toResourceIdentity(target);
					const unique = new Map(
						principals.map((principal) => [
							`${principal.principalType}:${principal.principalId}`,
							toPrincipalIdentity(principal),
						]),
					);
					const { data } = yield* callProcedure(deps, (options) =>
						resourceProcedures.grant(
							{
								...resource,
								principals: [
									...unique.values(),
								],
								role,
							},
							options,
						),
					).pipe(
						mutation("listAccess"),
						expectResource(target),
						expectPrincipals(principals),
					);

					return {
						...resource,
						role,
						granted: data.map((grant) => ({
							type: "grant" as const,
							principalType: grant.principal.type,
							principalId: grant.principalId,
							name: grant.principal.name,
						})),
					};
				}),
				abortSignal,
			),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: output,
		}),
	});
