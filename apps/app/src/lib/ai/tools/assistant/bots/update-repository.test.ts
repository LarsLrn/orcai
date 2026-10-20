import { beforeEach, describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import { defaultDatabaseBlockConfig } from "@orcai/schema";
import { ORPCError } from "@orpc/client";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";

const repositoryId = crypto.randomUUID() as BlockId;
const [a, b, c, d] = Array.from(
	{
		length: 4,
	},
	() => crypto.randomUUID() as AssetId,
);

const config = {
	...defaultDatabaseBlockConfig,
	maxReferences: 12,
};

beforeEach(() => {
	resetProcedures();
	answers["block.find"] = () =>
		Effect.succeed({
			data: {
				id: repositoryId,
				type: "database",
				name: "Sources",
				description: "Primary sources.",
				contentJson: {
					type: "doc",
				},
				contentHtml: "<p>Rich</p>",
				status: "ready",
				config,
				capabilities: {},
			},
			assets: [
				{
					id: a,
				},
				{
					id: b,
				},
			],
		});
	answers["block.update"] = (input: { assets: AssetId[] }) =>
		Effect.succeed({
			data: {
				id: repositoryId,
				name: "Sources",
				status: "ready",
			},
			assets: input.assets,
		});
});

const { updateRepositoryTool } = await import("./update-repository");
const { createAssistantTurn } = await import("../turn-state");

const run = (input: Record<string, unknown>) =>
	updateRepositoryTool({
		context: {} as ORPCContext,
		turn: createAssistantTurn({
			zedToken: undefined,
			chatId: "chat",
			replyId: "reply",
		}),
	}).execute?.(
		input as never,
		{
			toolCallId: "update",
			messages: [],
		} as never,
	);

describe("updateRepositoryTool", () => {
	test("an update sends the given assets as the full set and keeps the rest", async () => {
		const output = await run({
			id: repositoryId,
			assetIds: [
				b,
				c,
				c,
			],
		});

		expect(procedureCalls).toEqual([
			{
				procedure: "block.find",
				input: {
					id: repositoryId,
				},
			},
			{
				procedure: "block.update",
				input: {
					id: repositoryId,
					type: "database",
					name: "Sources",
					description: "Primary sources.",
					contentJson: {
						type: "doc",
					},
					contentHtml: "<p>Rich</p>",
					status: "ready",
					config,
					assets: [
						b,
						c,
					],
				},
			},
		]);
		expect(output).toEqual({
			type: "repository",
			id: repositoryId,
			name: "Sources",
			status: "ready",
			assetCount: 2,
		});
	});

	test("an update without assetIds keeps the current assets; [] empties it", async () => {
		await run({
			id: repositoryId,
			status: "draft",
		});
		await run({
			id: repositoryId,
			assetIds: [],
		});

		expect(
			procedureCalls
				.filter(({ procedure }) => procedure === "block.update")
				.map(
					({ input }) =>
						(
							input as {
								assets: AssetId[];
							}
						).assets,
				),
		).toEqual([
			[
				a,
				b,
			],
			[],
		]);
	});

	test("a template id reads as no repository with that id", async () => {
		answers["block.find"] = () =>
			Effect.succeed({
				data: {
					id: repositoryId,
					type: "template",
				},
			});

		await expect(
			run({
				id: repositoryId,
				name: "Renamed",
			}),
		).rejects.toThrow(
			`REPOSITORY_BLOCK_TYPE_INVALID: No repository with id ${repositoryId}. Ids of other kinds (bots, templates, assets, groups, members) are not repository ids. That id is a template.`,
		);
		expect(procedureCalls.map(({ procedure }) => procedure)).toEqual([
			"block.find",
		]);
	});

	test("a missing block reads as no repository with that id", async () => {
		answers["block.find"] = () =>
			Effect.fail(
				new ORPCError("NOT_FOUND", {
					message: "Block not found",
					data: {
						reason: "BLOCK_NOT_FOUND",
					},
				}),
			);

		await expect(
			run({
				id: repositoryId,
			}),
		).rejects.toThrow(
			`BLOCK_NOT_FOUND: No repository with id ${repositoryId}.`,
		);
	});

	test("an unreadable asset relays ASSET_LINK_FORBIDDEN", async () => {
		answers["block.update"] = () =>
			Effect.fail(
				new ORPCError("FORBIDDEN", {
					message:
						"You do not have access to attach one or more selected assets.",
					data: {
						reason: "ASSET_LINK_FORBIDDEN",
					},
				}),
			);

		await expect(
			run({
				id: repositoryId,
				assetIds: [
					d,
				],
			}),
		).rejects.toThrow(
			"ASSET_LINK_FORBIDDEN: You do not have access to attach one or more selected assets.",
		);
	});
});
