import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	mutation,
} from "../procedure-tool";
import { catalogueEntryInputSchema } from "./catalogue-entry-input";

const installInputSchema = z.strictObject({
	entry: catalogueEntryInputSchema,
});

export const installFromCatalogueTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Add a bot, template or repository from the catalogue to the active organisation's library. Nobody there can use it until it is shared with grantAccess, for use only (viewer). Set an added bot's model here with updateBotSetup. Adding what the organisation has already changes nothing.",
		inputSchema: installInputSchema,
		run: ({ entry }) =>
			Effect.gen(function* () {
				const { data: found } = yield* callProcedure(
					deps,
					(procedures, options) =>
						procedures.catalogue.find(
							{
								entry,
							},
							options,
						),
				);
				const { data } = yield* callProcedure(deps, (procedures, options) =>
					procedures.catalogue.install(
						{
							entry,
						},
						options,
					),
				).pipe(mutation("findCatalogue"));
				return {
					...entry,
					name: found.name,
					from: found.source.name,
					added: data.changed,
				};
			}),
	});
