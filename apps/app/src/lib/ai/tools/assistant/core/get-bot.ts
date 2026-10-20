import { botIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { blockProcedures } from "@/lib/orpc/router/block";
import { botProcedures } from "@/lib/orpc/router/bot";
import {
	type AssistantToolDeps,
	assistantTool,
	callProcedure,
	expectType,
	runAssistantTool,
} from "../procedure-tool";

export const getBotInputSchema = z.object({
	id: botIdSchema.describe("Id of the bot, from findBots."),
});

/** Editors get the links from the editor view; readers get the linked blocks they can read. */
export const getBotTool = (deps: AssistantToolDeps) =>
	assistantTool({
		description:
			"Read one bot: its name, description, status, features, linked AI behaviour (template) and repositories, and what the user may do with it.",
		inputSchema: getBotInputSchema,
		execute: ({ id }, { abortSignal }) =>
			runAssistantTool(
				Effect.gen(function* () {
					const { data: bot } = yield* callProcedure(deps, (options) =>
						botProcedures.find(
							{
								id,
							},
							options,
						),
					).pipe(expectType("bot", id));

					const links = bot.capabilities.edit
						? yield* callProcedure(deps, (options) =>
								botProcedures.findEditor(
									{
										id,
									},
									options,
								),
							).pipe(
								Effect.map(({ data }) => ({
									template: data.templateBlock,
									repositories: data.databaseBlocks.map((block) => ({
										type: "repository" as const,
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
									callProcedure(deps, (options) =>
										blockProcedures.find(
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
										template: template?.data ?? null,
										repositories: readable
											.filter(({ data }) => data.type === "database")
											.map(({ data, assets }) => ({
												type: "repository" as const,
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
						template: links.template
							? {
									type: "template" as const,
									id: links.template.id,
									name: links.template.name,
									status: links.template.status,
								}
							: null,
						repositories: links.repositories,
						canEdit: bot.capabilities.edit === true,
						canDelete: bot.capabilities.delete === true,
						canManageAccess: bot.capabilities.manage_access === true,
					};
				}),
				abortSignal,
			),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: output,
		}),
	});
