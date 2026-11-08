import { beforeEach, describe, expect, test } from "bun:test";
import type { AssetId } from "@orcai/core";
import * as Effect from "effect/Effect";
import { testRequestContext } from "@/lib/testing/request-context";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";

beforeEach(() => {
	resetProcedures();
	answers["asset.generateMissingMetadata"] = () =>
		Effect.succeed({
			count: 1,
		});
});

const { generateAssetMetadataTool } = await import("./generate-asset-metadata");
const { createAssistantTurn } = await import("../turn-state");

const assetIds = [
	crypto.randomUUID() as AssetId,
	crypto.randomUUID() as AssetId,
];

describe("generateAssetMetadataTool", () => {
	test("queues the assets and counts those it skipped", async () => {
		expect(
			await generateAssetMetadataTool({
				context: testRequestContext(),
				turn: createAssistantTurn({
					zedToken: undefined,
				}),
			}).execute?.(
				{
					assetIds,
				},
				{
					toolCallId: "generate",
					messages: [],
					context: {},
				},
			),
		).toEqual({
			queued: 1,
			skipped: 1,
		});
		expect(procedureCalls).toEqual([
			{
				procedure: "asset.generateMissingMetadata",
				input: {
					ids: assetIds,
				},
			},
		]);
	});

	test("counts a repeated asset once", async () => {
		const [assetId] = assetIds;

		expect(
			await generateAssetMetadataTool({
				context: testRequestContext(),
				turn: createAssistantTurn({
					zedToken: undefined,
				}),
			}).execute?.(
				{
					assetIds: [
						assetId,
						assetId,
					],
				},
				{
					toolCallId: "generate",
					messages: [],
					context: {},
				},
			),
		).toEqual({
			queued: 1,
			skipped: 0,
		});
		expect(procedureCalls.at(-1)?.input).toEqual({
			ids: [
				assetId,
			],
		});
	});
});
