import { beforeEach, describe, expect, test } from "bun:test";
import type { AssetId } from "@orcai/core";
import * as Effect from "effect/Effect";
import {
	answers,
	fakeContext,
	procedureCalls,
	resetProcedures,
} from "../test-procedures";
import { createAssistantTurn } from "../turn-state";
import { generateAssetMetadataTool } from "./generate-asset-metadata";

beforeEach(() => {
	resetProcedures();
	answers["asset.generateMissingMetadata"] = () =>
		Effect.succeed({
			count: 1,
		});
});

const assetIds = [
	crypto.randomUUID() as AssetId,
	crypto.randomUUID() as AssetId,
];

describe("generateAssetMetadataTool", () => {
	test("queues the assets and counts those it skipped", async () => {
		expect(
			await generateAssetMetadataTool({
				context: fakeContext,
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
				} as never,
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
				context: fakeContext,
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
				} as never,
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
