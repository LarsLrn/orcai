import { beforeEach, describe, expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";

const templateId = crypto.randomUUID() as BlockId;

const stored = {
	id: templateId,
	type: "template",
	name: "Strict",
	description: "Marks hard.",
	contentJson: {
		type: "doc",
	},
	status: "ready",
	config: {
		systemPrompt: "Be strict.",
	},
	capabilities: {},
};

beforeEach(() => {
	resetProcedures();
	answers["block.find"] = () =>
		Effect.succeed({
			data: stored,
		});
	answers["block.update"] = (input: { name: string; status: string }) =>
		Effect.succeed({
			data: {
				id: templateId,
				name: input.name,
				status: input.status,
			},
		});
});

const { updateBehaviourTool } = await import("./update-behaviour");
const { createAssistantTurn } = await import("../turn-state");

const run = (input: Record<string, unknown>) =>
	updateBehaviourTool({
		context: {} as ORPCContext,
		turn: createAssistantTurn({
			zedToken: undefined,
			chatId: "chat",
			replyId: "reply",
		}),
	}).execute?.(
		input as never,
		{
			toolCallId: "update",
			messages: [],
		} as never,
	);

describe("updateBehaviourTool", () => {
	test("an update takes only the changed fields and keeps the rest", async () => {
		const output = await run({
			id: templateId,
			systemPrompt: "Be kind.",
		});

		expect(
			procedureCalls.find(({ procedure }) => procedure === "block.update")
				?.input,
		).toEqual({
			id: templateId,
			type: "template",
			name: "Strict",
			description: "Marks hard.",
			contentJson: {
				type: "doc",
			},
			status: "ready",
			config: {
				systemPrompt: "Be kind.",
			},
		});
		expect(output).toEqual({
			type: "template",
			id: templateId,
			name: "Strict",
			status: "ready",
		});
	});

	test("a repository id reads as no template with that id", async () => {
		answers["block.find"] = () =>
			Effect.succeed({
				data: {
					...stored,
					type: "database",
				},
			});

		await expect(
			run({
				id: templateId,
				name: "Renamed",
			}),
		).rejects.toThrow(
			`BEHAVIOUR_BLOCK_TYPE_INVALID: No template with id ${templateId}. Ids of other kinds (bots, repositories, assets, groups, members, invitations) are not template ids. That id is a repository.`,
		);
	});
});
