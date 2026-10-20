import { beforeEach, describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";

beforeEach(() => {
	resetProcedures();
	for (const name of [
		"retryProcessing",
		"retryVectorization",
	]) {
		answers[`job.${name}`] = () =>
			Effect.succeed({
				success: true,
				message: "",
			});
	}
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
				procedure: "job.retryProcessing",
				input: {
					assetId,
				},
			},
		]);
	});

	test("with a repository it retries vectorisation in that repository", async () => {
		expect(
			await run({
				assetId,
				repositoryId,
			}),
		).toMatchObject({
			type: "asset",
			id: assetId,
			repositoryId,
			retried: "vectorisation",
		});
		expect(procedureCalls).toEqual([
			{
				procedure: "job.retryVectorization",
				input: {
					assetId,
					blockId: repositoryId,
				},
			},
		]);
	});
});
