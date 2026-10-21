import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";
import { mergeAccess } from "./merge-access";
import {
	expectResource,
	resourceTargetShape,
	toResourceIdentity,
} from "./resource-target";

const listAccessInputSchema = z.object(resourceTargetShape);

export const listAccessTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"List who has access to a bot, block or asset: direct grants with their roles (viewer, editor, manager), and the users and groups that reach it through a bot or block it belongs to. Needs manage access on the resource. Public visibility (everyone on the instance) is not shown here and is set only in the resource's access dialog in the editor, never by the assistant.",
		inputSchema: listAccessInputSchema,
		run: (input) =>
			Effect.gen(function* () {
				const resource = toResourceIdentity(input);
				const [grants, inherited] = yield* Effect.all(
					[
						callProcedure(deps, (procedures, options) =>
							procedures.resource.listGrants(resource, options),
						).pipe(expectResource(input)),
						callProcedure(deps, (procedures, options) =>
							procedures.resource.inheritedAccess(resource, options),
						).pipe(expectResource(input)),
					],
					{
						concurrency: "unbounded",
					},
				);

				return mergeAccess(grants.data, inherited.data);
			}),
	});
