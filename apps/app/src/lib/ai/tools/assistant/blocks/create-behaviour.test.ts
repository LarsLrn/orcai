import { beforeEach, describe, expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import * as Effect from "effect/Effect";
import {
	answers,
	fakeContext,
	procedureCalls,
	resetProcedures,
} from "../test-procedures";
import { createAssistantTurn } from "../turn-state";
import { createBehaviourTool } from "./create-behaviour";
import { createBehaviourInputSchema } from "./create-behaviour.declaration";

const behaviourId = crypto.randomUUID() as BlockId;

beforeEach(() => {
	resetProcedures();
	answers["block.create"] = (input: { name: string; status: string }) =>
		Effect.succeed({
			data: {
				id: behaviourId,
				name: input.name,
				status: input.status,
			},
		});
});

describe("createBehaviourTool", () => {
	test("the schema requires a name and a system prompt", () => {
		expect(
			createBehaviourInputSchema.safeParse({
				name: "New",
			}).success,
		).toBe(false);
	});

	test("a create is a draft with the given system prompt", async () => {
		const output = await createBehaviourTool({
			context: fakeContext,
			turn: createAssistantTurn({
				zedToken: undefined,
			}),
		}).execute?.(
			{
				name: "Strict",
				description: " ",
				systemPrompt: "Be strict.",
			},
			{
				toolCallId: "create",
				messages: [],
			} as never,
		);

		expect(procedureCalls).toEqual([
			{
				procedure: "block.create",
				input: {
					type: "behaviour",
					name: "Strict",
					description: null,
					contentJson: null,
					status: "draft",
					config: {
						systemPrompt: "Be strict.",
					},
				},
			},
		]);
		expect(output).toEqual({
			type: "behaviour",
			id: behaviourId,
			name: "Strict",
			status: "draft",
		});
	});
});
