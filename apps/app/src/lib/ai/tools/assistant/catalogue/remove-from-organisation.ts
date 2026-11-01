import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	mutation,
} from "../procedure-tool";
import {
	catalogueEntryInputSchema,
	toCatalogueEntry,
} from "./catalogue-entry-input";

const removeInputSchema = z.strictObject({
	entry: catalogueEntryInputSchema,
});

export const removeFromOrganisationTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Remove a bot, behaviour or repository the active organisation added from the Catalogue. Its grants here, a bot's model setup here, and the organisation's bots' and chats' links to a block go with it. Chats with a removed bot turn read-only until it is added and shared again.",
		inputSchema: removeInputSchema,
		run: ({ entry }) =>
			Effect.gen(function* () {
				const { data: found } = yield* callProcedure(
					deps,
					(procedures, options) =>
						procedures.catalogue.find(
							{
								entry: toCatalogueEntry(entry),
							},
							options,
						),
				);
				const { data } = yield* callProcedure(deps, (procedures, options) =>
					procedures.catalogue.remove(
						{
							entry: toCatalogueEntry(entry),
						},
						options,
					),
				).pipe(mutation("findCatalogue"));
				return {
					...entry,
					name: found.name,
					removed: data.changed,
				};
			}),
	});
