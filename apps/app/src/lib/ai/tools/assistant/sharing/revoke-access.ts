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

const revokeAccessInputSchema = z.strictObject({
	...targetShape,
	...granteeShape,
});

export const revokeAccessTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Remove one user's or group's direct grant on a bot, block or asset. Access they have through a group, or through a bot or block it belongs to, stays. The last manager keeps the role.",
		inputSchema: revokeAccessInputSchema,
		run: ({ granteeType, granteeId, ...target }) =>
			Effect.gen(function* () {
				const grantee = {
					granteeType,
					granteeId,
				};
				const { message } = yield* callProcedure(deps, (procedures, options) =>
					procedures.resource.revoke(
						{
							...toResourceIdentity(target),
							...toPrincipalIdentity(grantee),
						},
						options,
					),
				).pipe(
					mutation("listAccess"),
					expectTarget(target),
					expectGrantees([
						grantee,
					]),
				);

				return {
					...target,
					...grantee,
					message,
				};
			}),
	});
