import { afterEach, describe, expect, test } from "bun:test";
import type { Repository } from "@orcai/schema";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import {
	answers,
	procedureCalls,
	resetProcedures,
} from "../assistant/test-procedures";

const { listRepositoryAssetsTool } = await import("./list-repository-assets");

afterEach(resetProcedures);

describe("listRepositoryAssets", () => {
	test("each asset carries its state, and a failed one its failure", async () => {
		answers["block.readiness"] = () =>
			Effect.succeed({
				data: [
					{
						blockId: "block-1",
						name: "Handbook",
						totals: {
							total: 2,
							ready: 1,
							preparing: 0,
							failed: 1,
						},
						assets: [
							{
								assetId: "asset-1",
								title: "Policies",
								state: "ready",
								failure: null,
							},
							{
								assetId: "asset-2",
								title: "Scans",
								state: "failed",
								failure: {
									stage: "processing",
									kind: "empty",
								},
							},
						],
					},
				],
			});
		answers["asset.list"] = () =>
			Effect.succeed({
				data: [
					{
						id: "asset-1",
						metadata: {
							citationLabel: "Handbook 2026",
							description: "Rules for staff.",
						},
					},
					{
						id: "asset-2",
						metadata: {},
					},
				],
			});

		const output = await listRepositoryAssetsTool({
			blocks: [
				{
					id: "block-1",
					name: "Handbook",
					config: {},
				},
			] as unknown as Repository[],
			context: {} as ORPCContext,
		}).execute?.(
			{
				limit: 30,
			},
			{
				toolCallId: "call",
				messages: [],
				context: {},
			},
		);

		expect(output).toMatchObject({
			assets: [
				{
					assetId: "asset-1",
					title: "Policies",
					citationLabel: "Handbook 2026",
					description: "Rules for staff.",
					state: "ready",
					failure: undefined,
				},
				{
					assetId: "asset-2",
					title: "Scans",
					state: "failed",
					failure: {
						stage: "processing",
						kind: "empty",
					},
				},
			],
		});
	});

	test("reads the readiness of many repositories in batches", async () => {
		answers["block.readiness"] = () =>
			Effect.succeed({
				data: [],
			});

		await listRepositoryAssetsTool({
			blocks: Array.from(
				{
					length: 101,
				},
				(_, index) => ({
					id: `block-${index}`,
					name: `Repository ${index}`,
					config: {},
				}),
			) as unknown as Repository[],
			context: {} as ORPCContext,
		}).execute?.(
			{
				limit: 30,
			},
			{
				toolCallId: "call",
				messages: [],
				context: {},
			},
		);

		expect(
			procedureCalls.map(
				(call) =>
					(
						call.input as {
							blockIds: string[];
						}
					).blockIds.length,
			),
		).toEqual([
			100,
			1,
		]);
	});
});
