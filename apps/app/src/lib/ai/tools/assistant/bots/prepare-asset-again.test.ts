import { beforeEach, describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";

beforeEach(() => {
	resetProcedures();
	answers["asset.prepareAgain"] = () =>
		Effect.succeed({
			success: true,
			message: "",
		});
	answers["block.prepareAssetAgain"] = () =>
		Effect.succeed({
			retried: "indexing",
		});
});

const { prepareAssetAgainTool } = await import("./prepare-asset-again");
const { createAssistantTurn } = await import("../turn-state");

const assetId = crypto.randomUUID() as AssetId;
const repositoryId = crypto.randomUUID() as BlockId;

const run = (input: { assetId: AssetId; repositoryId?: BlockId }) =>
	prepareAssetAgainTool({
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

describe("prepareAssetAgainTool", () => {
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
				procedure: "asset.prepareAgain",
				input: {
					id: assetId,
				},
			},
		]);
	});

	test("with a repository it retries the asset there", async () => {
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
				procedure: "block.prepareAssetAgain",
				input: {
					assetId,
					blockId: repositoryId,
				},
			},
		]);
	});
});
