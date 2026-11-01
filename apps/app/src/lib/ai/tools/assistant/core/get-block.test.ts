import { beforeEach, describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import { ORPCError } from "@orpc/client";
import type { Tool } from "ai";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";

const { getBlockTool } = await import("./get-block");
const { createAssistantTurn } = await import("../turn-state");

const deps = () => ({
	context: {
		secureCookies: false,
	} as ORPCContext,
	turn: createAssistantTurn({
		zedToken: undefined,
		chatId: "chat",
		replyId: "reply",
	}),
});

const run = async <Input, Output>(
	tool: Tool<Input, Output>,
	input: Input,
): Promise<Output> =>
	(await tool.execute?.(input, {
		toolCallId: "call-1",
		messages: [],
		context: {},
	})) as Output;

const id = <Id extends string>() => crypto.randomUUID() as Id;

const block = (type: "template" | "database", config: object) => ({
	id: id<BlockId>(),
	name: type === "template" ? "Strict" : "Sources",
	type,
	status: "ready",
	description: null,
	contentJson: {
		type: "doc",
	},
	config,
	capabilities: {
		read: true,
		edit: true,
	},
});

beforeEach(resetProcedures);

describe("getBlock", () => {
	test("a template comes with its system prompt and no rich content", async () => {
		const template = block("template", {
			systemPrompt: "Be strict.",
		});
		answers["block.find"] = () =>
			Effect.succeed({
				data: template,
			});

		const output = await run(getBlockTool(deps()), {
			id: template.id,
		});

		expect(output).toEqual({
			type: "template",
			id: template.id,
			name: "Strict",
			description: null,
			status: "ready",
			canEdit: true,
			canDelete: false,
			canManageAccess: false,
			systemPrompt: "Be strict.",
		});
		expect(procedureCalls.map((call) => call.procedure)).toEqual([
			"block.find",
		]);
	});

	test("a repository lists its asset totals and each asset's state", async () => {
		const config = {
			minReferences: 1,
			maxReferences: 8,
			defaultReferences: 4,
			retrievalMode: "hybrid" as const,
		};
		const repository = block("database", config);
		const [ready, failed, queued] = [
			id<AssetId>(),
			id<AssetId>(),
			id<AssetId>(),
		];
		answers["block.find"] = () =>
			Effect.succeed({
				data: repository,
			});
		answers["block.readiness"] = () =>
			Effect.succeed({
				data: [
					{
						blockId: repository.id,
						name: repository.name,
						capabilities: repository.capabilities,
						totals: {
							total: 3,
							ready: 1,
							preparing: 1,
							failed: 1,
						},
						assets: [
							{
								assetId: ready,
								title: "Handbook",
								state: "ready",
								failure: null,
							},
							{
								assetId: failed,
								title: "Slides",
								state: "failed",
								failure: {
									stage: "processing",
									kind: "empty",
								},
							},
							{
								assetId: queued,
								title: "Notes",
								state: "queued",
								failure: null,
							},
						],
					},
				],
			});

		const output = await run(getBlockTool(deps()), {
			id: repository.id,
		});

		expect(output).toEqual({
			type: "repository",
			id: repository.id,
			name: "Sources",
			description: null,
			status: "ready",
			canEdit: true,
			canDelete: false,
			canManageAccess: false,
			assetTotals: {
				total: 3,
				ready: 1,
				preparing: 1,
				failed: 1,
			},
			assets: [
				{
					id: ready,
					title: "Handbook",
					state: "ready",
					failure: undefined,
				},
				{
					id: failed,
					title: "Slides",
					state: "failed",
					failure: {
						stage: "processing",
						kind: "empty",
					},
				},
				{
					id: queued,
					title: "Notes",
					state: "queued",
					failure: undefined,
				},
			],
		});
		expect(procedureCalls[1]).toEqual({
			procedure: "block.readiness",
			input: {
				blockIds: [
					repository.id,
				],
			},
		});
	});

	test("an unknown or unreadable id names the expected types", async () => {
		const missing = id<BlockId>();
		answers["block.find"] = () =>
			Effect.fail(
				new ORPCError("FORBIDDEN", {
					data: {
						reason: "PERMISSION_DENIED",
					},
				}),
			);

		await expect(
			run(getBlockTool(deps()), {
				id: missing,
			}),
		).rejects.toThrow(
			`BLOCK_NOT_FOUND: No template or repository with id ${missing}`,
		);
	});
});
