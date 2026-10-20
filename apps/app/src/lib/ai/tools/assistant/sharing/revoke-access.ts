import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { resourceProcedures } from "@/lib/orpc/router/resource";
import {
	type AssistantToolDeps,
	assistantTool,
	callProcedure,
	mutation,
	runAssistantTool,
} from "../procedure-tool";
import {
	expectPrincipals,
	expectResource,
	principalShape,
	resourceTargetShape,
	toPrincipalIdentity,
	toResourceIdentity,
} from "./resource-target";

export const revokeAccessInputSchema = z.object({
	...resourceTargetShape,
	...principalShape,
});

export const revokeAccessTool = (deps: AssistantToolDeps) =>
	assistantTool({
		description:
			"Remove one user's or group's direct grant on a bot, block or asset. Access they have through a group or a bot above stays. The last manager cannot be removed. The user confirms before it runs.",
		inputSchema: revokeAccessInputSchema,
		execute: ({ principalType, principalId, ...target }, { abortSignal }) =>
			runAssistantTool(
				Effect.gen(function* () {
					const resource = toResourceIdentity(target);
					const principal = toPrincipalIdentity({
						principalType,
						principalId,
					});
					const { message } = yield* callProcedure(deps, (options) =>
						resourceProcedures.revoke(
							{
								...resource,
								...principal,
							},
							options,
						),
					).pipe(
						mutation("listAccess"),
						expectResource(target),
						expectPrincipals([
							principal,
						]),
					);

					return {
						...resource,
						...principal,
						message,
					};
				}),
				abortSignal,
			),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: output,
		}),
	});
