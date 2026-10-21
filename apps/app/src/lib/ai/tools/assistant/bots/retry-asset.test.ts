import { beforeEach, describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";

beforeEach(() => {
	resetProcedures();
	answers["asset.reprocess"] = () =>
		Effect.succeed({
			success: true,
			message: "",
		});
	answers["block.retryDocument"] = () =>
		Effect.succeed({
			retried: "indexing",
		});
});

const { retryAssetTool } = await import("./retry-asset");
const { createAssistantTurn } = await import("../turn-state");

const assetId = crypto.randomUUID() as AssetId;
const repositoryId = crypto.randomUUID() as BlockId;

const run = (input: { assetId: AssetId; repositoryId?: BlockId }) =>
	retryAssetTool({
		context: {} as ORPCContext,
		turn: createAssistantTurn({
			zedToken: undefined,
			chatId: "chat",
			replyId: "reply",
		}),
	}).execute?.(input, {
		toolCallId: "retry",
		messages: [],
	} as never);

describe("retryAssetTool", () => {
	test("without a repository it retries processing", async () => {
		expect(
			await run({
				assetId,
			}),
		).toMatchObject({
			type: "asset",
			id: assetId,
			retried: "processing",
		});
		expect(procedureCalls).toEqual([
			{
				procedure: "asset.reprocess",
				input: {
					id: assetId,
				},
			},
		]);
	});

	test("with a repository it retries the document there", async () => {
		expect(
			await run({
				assetId,
				repositoryId,
			}),
		).toMatchObject({
			type: "asset",
			id: assetId,
			repositoryId,
			retried: "indexing",
		});
		expect(procedureCalls).toEqual([
			{
				procedure: "block.retryDocument",
				input: {
					assetId,
					blockId: repositoryId,
				},
			},
		]);
	});
});
