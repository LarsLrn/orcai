import { resourceGrantRoleSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	mutation,
} from "../procedure-tool";
import {
	expectGrantees,
	expectTarget,
	granteeShape,
	targetShape,
	toPrincipalIdentity,
	toResourceIdentity,
} from "./resource-target";

const grantAccessInputSchema = z.strictObject({
	...targetShape,
	grantees: z
		.array(z.strictObject(granteeShape))
		.min(1)
		.max(50)
		.describe("The users and groups that get the role."),
	role: resourceGrantRoleSchema.describe(
		"viewer: Can view, to read and use it. editor: Can edit, also to edit it. manager: Can manage, also to manage its access.",
	),
});

export const grantAccessTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Give users or groups a role on one bot, block or asset. Someone who already has a role there gets the new one instead. It grants on the named item only, not on a bot's behaviour or repositories. The user needs Can manage on the item.",
		inputSchema: grantAccessInputSchema,
		run: ({ grantees, role, ...target }) =>
			Effect.gen(function* () {
				const resource = toResourceIdentity(target);
				const unique = new Map(
					grantees.map((grantee) => [
						`${grantee.granteeType}:${grantee.granteeId}`,
						toPrincipalIdentity(grantee),
					]),
				);
				const { data } = yield* callProcedure(deps, (procedures, options) =>
					procedures.resource.grant(
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
					expectTarget(target),
					expectGrantees(grantees),
				);

				return {
					...target,
					role,
					granted: data.map((grant) => ({
						type: "grant" as const,
						granteeType: grant.principal.type,
						granteeId: grant.principalId,
						name: grant.principal.name,
					})),
				};
			}),
	});
