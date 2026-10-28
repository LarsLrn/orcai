import { beforeEach, describe, expect, test } from "bun:test";
import type { AssetId } from "@orcai/core";
import type { AssetMetadataType } from "@orcai/schema";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";

const assetId = crypto.randomUUID() as AssetId;
const stored: AssetMetadataType = {
	sourceType: "book",
	author: "Ada Lovelace",
	citation: "Lovelace 1843",
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

const { mergeAssetMetadata, updateAssetTool } = await import("./update-asset");
const { createAssistantTurn } = await import("../turn-state");

describe("mergeAssetMetadata", () => {
	test("given keys replace stored ones, the rest stay", () => {
		expect(
			mergeAssetMetadata(stored, {
				author: "Charles Babbage",
				doi: "10.1000/182",
			}),
		).toEqual({
			...stored,
			author: "Charles Babbage",
			doi: "10.1000/182",
		});
	});

	test("undefined keys and a missing patch keep the stored values", () => {
		expect(
			mergeAssetMetadata(stored, {
				author: undefined,
			}),
		).toEqual(stored);
		expect(mergeAssetMetadata(stored)).toEqual(stored);
	});
});

describe("updateAssetTool", () => {
	test("saves the stored title and merged metadata", async () => {
		await updateAssetTool({
			context: {} as ORPCContext,
			turn: createAssistantTurn({
				zedToken: undefined,
				chatId: "chat",
				replyId: "reply",
			}),
		}).execute?.(
			{
				id: assetId,
				metadata: {
					citation: "Lovelace 1843, note G",
				},
			},
			{
				toolCallId: "update",
				messages: [],
			} as never,
		);

		expect(
			procedureCalls
				.filter(({ procedure }) => procedure === "asset.save")
				.map(({ input }) => input),
		).toEqual([
			{
				id: assetId,
				title: "Notes",
				metadata: {
					...stored,
					citation: "Lovelace 1843, note G",
				},
			},
		]);
	});
});
