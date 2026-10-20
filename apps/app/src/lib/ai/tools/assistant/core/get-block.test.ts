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
	contentHtml: "<p>Rich</p>",
	config,
	capabilities: {
		read: true,
		edit: true,
	},
});

const job = (
	assetId: AssetId,
	blockId: BlockId,
	state: string,
	createdOn: string,
) => ({
	name: "vectorize-asset-job",
	state,
	createdOn: new Date(createdOn),
	data: {
		assetId,
		blockId,
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

	test("a repository lists each asset with its newest vectorisation state", async () => {
		const config = {
			minReferences: 1,
			maxReferences: 8,
			defaultReferences: 4,
			retrievalMode: "hybrid" as const,
		};
		const repository = block("database", config);
		const [indexed, failed, pending] = [
			id<AssetId>(),
			id<AssetId>(),
			id<AssetId>(),
		];
		answers["block.find"] = () =>
			Effect.succeed({
				data: repository,
				assets: [
					{
						id: indexed,
						title: "Handbook",
						processingStatus: "completed",
						contentHtml: "<p>Rich</p>",
					},
					{
						id: failed,
						title: "Slides",
						processingStatus: "completed",
					},
					{
						id: pending,
						title: "Notes",
						processingStatus: "pending",
					},
				],
			});
		answers["job.list"] = () =>
			Effect.succeed({
				data: [
					job(indexed, repository.id, "failed", "2026-10-01"),
					job(indexed, repository.id, "completed", "2026-10-02"),
					job(failed, repository.id, "failed", "2026-10-02"),
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
			retrieval: config,
			assets: [
				{
					type: "asset",
					id: indexed,
					title: "Handbook",
					processingStatus: "completed",
					vectorisation: "completed",
				},
				{
					type: "asset",
					id: failed,
					title: "Slides",
					processingStatus: "completed",
					vectorisation: "failed",
				},
				{
					type: "asset",
					id: pending,
					title: "Notes",
					processingStatus: "pending",
					vectorisation: "none",
				},
			],
		});
		expect(procedureCalls[1]).toEqual({
			procedure: "job.list",
			input: {
				resourceType: "block",
				resourceId: repository.id,
				jobQueue: "vectorize-asset-job",
			},
		});
	});

	test("an empty repository reads no jobs", async () => {
		const repository = block("database", {});
		answers["block.find"] = () =>
			Effect.succeed({
				data: repository,
				assets: [],
			});

		const output = await run(getBlockTool(deps()), {
			id: repository.id,
		});

		expect(output).toMatchObject({
			type: "repository",
			assets: [],
		});
		expect(procedureCalls).toHaveLength(1);
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
