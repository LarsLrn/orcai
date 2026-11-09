import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import {
	type AssistantToolDeps,
	callProcedure,
	mutation,
} from "../procedure-tool";
import { grantAccessInputSchema } from "./grant-access.declaration";
import {
	expectGrantees,
	expectTarget,
	toPrincipalIdentity,
	toResourceIdentity,
} from "./resource-target";

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
