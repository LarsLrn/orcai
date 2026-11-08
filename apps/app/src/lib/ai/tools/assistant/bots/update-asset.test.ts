import { beforeEach, describe, expect, test } from "bun:test";
import type { AssetId } from "@orcai/core";
import type { AssetMetadataType } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { testRequestContext } from "@/lib/testing/request-context";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";

const assetId = crypto.randomUUID() as AssetId;
const stored: AssetMetadataType = {
	sourceType: "book",
	author: "Ada Lovelace",
	citationLabel: "Lovelace 1843",
};

beforeEach(() => {
	resetProcedures();
	answers["asset.find"] = () =>
		Effect.succeed({
			data: {
				id: assetId,
				title: "Notes",
				metadata: stored,
				capabilities: {},
			},
		});
	answers["asset.save"] = (input: unknown) =>
		Effect.succeed({
			data: input,
		});
});

const { updateAssetTool } = await import("./update-asset");
const { createAssistantTurn } = await import("../turn-state");

describe("updateAssetTool", () => {
	test("saves only the given fields", async () => {
		await updateAssetTool({
			context: testRequestContext(),
			turn: createAssistantTurn({
				zedToken: undefined,
			}),
		}).execute?.(
			{
				id: assetId,
				metadata: {
					citationLabel: "Lovelace 1843, note G",
				},
			},
			{
				toolCallId: "update",
				messages: [],
				context: {},
			},
		);

		expect(
			procedureCalls
				.filter(({ procedure }) => procedure === "asset.save")
				.map(({ input }) => input),
		).toEqual([
			{
				id: assetId,
				metadata: {
					citationLabel: "Lovelace 1843, note G",
				},
			},
		]);
	});
});
