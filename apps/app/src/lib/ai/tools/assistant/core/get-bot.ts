import { botIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { readSetup } from "../bots/setup-input";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
} from "../procedure-tool";

const getBotInputSchema = z.strictObject({
	id: botIdSchema.describe("Id of the bot, from findBots."),
});

/** Editors get the links from the editor view; readers get the linked blocks they can read. */
export const getBotTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Read one bot: its name, description, status, features, behaviour and repositories, its model in the active organisation (with quota pool coverage for its editors), and what the user may do with it.",
		inputSchema: getBotInputSchema,
		run: ({ id }) =>
			Effect.gen(function* () {
				const { data: bot } = yield* callProcedure(
					deps,
					(procedures, options) =>
						procedures.bot.find(
							{
								id,
							},
							options,
						),
				).pipe(expectType("bot", id));

				const links = bot.capabilities.edit
					? yield* callProcedure(deps, (procedures, options) =>
							procedures.bot.findEditor(
								{
									id,
								},
								options,
							),
						).pipe(
							Effect.map(({ data }) => ({
								behaviour: data.templateBlock,
								repositories: data.databaseBlocks.map((block) => ({
									id: block.id,
									name: block.name,
									status: block.status,
									assetCount: block.assetIds.length,
								})),
							})),
						)
					: yield* Effect.forEach(
							bot.blockIds,
							(blockId) =>
								callProcedure(deps, (procedures, options) =>
									procedures.block.find(
										{
											id: blockId,
										},
										options,
									),
								).pipe(Effect.orElseSucceed(() => undefined)),
							{
								concurrency: "unbounded",
							},
						).pipe(
							Effect.map((found) => {
								const readable = found.filter((block) => block !== undefined);
								const template = readable.find(
									({ data }) => data.type === "template",
								);

								return {
									behaviour: template?.data ?? null,
									repositories: readable
										.filter(({ data }) => data.type === "database")
										.map(({ data, assets }) => ({
											id: data.id,
											name: data.name,
											status: data.status,
											assetCount: assets?.length ?? 0,
										})),
								};
							}),
						);

				return {
					type: "bot" as const,
					id: bot.id,
					name: bot.name,
					description: bot.description,
					status: bot.status,
					features: bot.features,
					behaviour: links.behaviour
						? {
								type: "template" as const,
								id: links.behaviour.id,
								name: links.behaviour.name,
								status: links.behaviour.status,
							}
						: null,
					repositories: links.repositories,
					setup: yield* readSetup(deps, id),
					canEdit: bot.capabilities.edit === true,
					canDelete: bot.capabilities.delete === true,
					canManageAccess: bot.capabilities.manage_access === true,
				};
			}),
	});
