import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";
import { mergeAccess } from "./merge-access";
import {
	expectTarget,
	targetShape,
	toResourceIdentity,
} from "./resource-target";

const listAccessInputSchema = z.strictObject(targetShape);

export const listAccessTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"List who has access to a bot, block or asset: direct grants with their roles (viewer, editor, manager, as in grantAccess), and the users and groups that reach it through a bot or block it belongs to. The user needs Can manage on the item.",
		inputSchema: listAccessInputSchema,
		run: (input) =>
			Effect.gen(function* () {
				const resource = toResourceIdentity(input);
				const [grants, inherited] = yield* Effect.all(
					[
						callProcedure(deps, (procedures, options) =>
							procedures.resource.listGrants(resource, options),
						).pipe(expectTarget(input)),
						callProcedure(deps, (procedures, options) =>
							procedures.resource.inheritedAccess(resource, options),
						).pipe(expectTarget(input)),
					],
					{
						concurrency: "unbounded",
					},
				);

				return mergeAccess(grants.data, inherited.data);
			}),
	});
