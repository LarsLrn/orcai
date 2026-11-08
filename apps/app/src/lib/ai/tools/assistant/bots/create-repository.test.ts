import { beforeEach, describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import { defaultRepositoryConfig } from "@orcai/schema";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";
import { createRepositoryInputSchema } from "./create-repository.declaration";

const repositoryId = crypto.randomUUID() as BlockId;
const asset = crypto.randomUUID() as AssetId;

beforeEach(() => {
	resetProcedures();
	answers["block.create"] = (input: { assets: AssetId[] }) =>
		Effect.succeed({
			data: {
				id: repositoryId,
				name: "New",
				status: "draft",
			},
			assets: input.assets,
		});
});

const { createRepositoryTool } = await import("./create-repository");
const { createAssistantTurn } = await import("../turn-state");

describe("createRepositoryTool", () => {
	test("the schema requires a name", () => {
		expect(createRepositoryInputSchema.safeParse({}).success).toBe(false);
	});

	test("a create is a draft with the default retrieval settings", async () => {
		const output = await createRepositoryTool({
			context: {} as ORPCContext,
			turn: createAssistantTurn({
				zedToken: undefined,
			}),
		}).execute?.(
			{
				name: "New",
				assetIds: [
					asset,
					asset,
				],
			},
			{
				toolCallId: "create",
				messages: [],
				context: {},
			},
		);

		expect(procedureCalls).toEqual([
			{
				procedure: "block.create",
				input: expect.objectContaining({
					type: "repository",
					name: "New",
					status: "draft",
					config: defaultRepositoryConfig,
					assets: [
						asset,
					],
				}),
			},
		]);
		expect(output).toEqual({
			type: "repository",
			id: repositoryId,
			name: "New",
			status: "draft",
			assetCount: 1,
		});
	});
});
