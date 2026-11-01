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

const addInputSchema = z.strictObject({
	entry: catalogueEntryInputSchema,
	withBlocks: z
		.boolean()
		.default(false)
		.describe(
			"For a bot: also add its behaviour and repositories, each on its own, so the organisation can build its own bots from them. Removing the bot later keeps them. Only when the user asks for them.",
		),
});

export const addFromCatalogueTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Add a bot, behaviour or repository from the Catalogue to the active organisation's Library. For new files, use requestUpload instead. Nobody in the organisation can use it until it is shared with grantAccess, for use only (role viewer). Set an added bot's model with updateBotSetup. Adding what the organisation has already changes nothing, and with withBlocks the blocks it has already are skipped.",
		inputSchema: addInputSchema,
		run: ({ entry, withBlocks }) =>
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
					procedures.catalogue.add(
						{
							entry: toCatalogueEntry(entry),
							withBlocks,
						},
						options,
					),
				).pipe(mutation("findCatalogue"));
				return {
					...entry,
					name: found.name,
					from: found.homeOrganization.name,
					added: data.changed,
					addedBlocks: data.addedBlocks,
				};
			}),
	});
