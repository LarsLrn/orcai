import { beforeEach, describe, expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";

const templateId = crypto.randomUUID() as BlockId;

beforeEach(() => {
	resetProcedures();
	answers["block.create"] = (input: { name: string; status: string }) =>
		Effect.succeed({
			data: {
				id: templateId,
				name: input.name,
				status: input.status,
			},
		});
});

const { createBehaviourInputSchema, createBehaviourTool } = await import(
	"./create-behaviour"
);
const { createAssistantTurn } = await import("../turn-state");

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
			context: {} as ORPCContext,
			turn: createAssistantTurn({
				zedToken: undefined,
				chatId: "chat",
				replyId: "reply",
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
					type: "template",
					name: "Strict",
					description: null,
					contentJson: null,
					contentHtml: null,
					status: "draft",
					config: {
						systemPrompt: "Be strict.",
					},
				},
			},
		]);
		expect(output).toEqual({
			type: "template",
			id: templateId,
			name: "Strict",
			status: "draft",
		});
	});
});
