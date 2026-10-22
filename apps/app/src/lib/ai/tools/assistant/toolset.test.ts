import { describe, expect, test } from "bun:test";
import { providerCompaction } from "@orcai/ai";
import { asSchema, type ToolSet } from "ai";
import { createAssistantSession } from "@/lib/ai/agents/assistant-session";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import "./test-procedures";
import { createAssistantTurn } from "./turn-state";

const { buildAssistantTools } = await import("./toolset");

const tools: ToolSet = buildAssistantTools({
	context: {
		secureCookies: false,
	} as ORPCContext,
	turn: createAssistantTurn({
		zedToken: undefined,
		chatId: "chat",
		replyId: "reply",
	}),
	docs: undefined,
	history: [],
	session: createAssistantSession({
		history: [],
		capabilities: {
			read: true,
		},
		toolLoading: {
			type: "active-tools",
		},
		compaction: providerCompaction("openai-compatible", 100_000),
	}),
});

const FORBIDDEN_KEYS = [
	"zedToken",
	"organizationId",
];

/** Every property name anywhere in a JSON Schema. */
const propertyNames = (schema: unknown): string[] => {
	if (Array.isArray(schema)) {
		return schema.flatMap(propertyNames);
	}
	if (typeof schema !== "object" || schema === null) {
		return [];
	}

	const own =
		"properties" in schema &&
		typeof schema.properties === "object" &&
		schema.properties !== null
			? Object.keys(schema.properties)
			: [];

	return [
		...own,
		...Object.values(schema).flatMap(propertyNames),
	];
};

describe("buildAssistantTools", () => {
	test.each(Object.entries(tools))(
		"%s has a model-facing input schema",
		async (_, tool) => {
			const jsonSchema = await asSchema(tool.inputSchema).jsonSchema;

			expect(jsonSchema.type).toBe("object");
			for (const key of FORBIDDEN_KEYS) {
				expect(propertyNames(jsonSchema)).not.toContain(key);
			}
		},
	);

	test("tells the model which tools the user confirms", () => {
		const confirming = Object.entries(tools)
			.filter(
				([, tool]) =>
					typeof tool.description === "string" &&
					tool.description.endsWith("The user confirms before it runs."),
			)
			.map(([name]) => name);

		expect(confirming).toEqual([
			"deleteBot",
			"deleteBlock",
			"deleteAsset",
			"grantAccess",
			"revokeAccess",
			"deleteGroup",
			"addGroupMembers",
			"removeGroupMembers",
			"changeMemberRole",
			"removeMembers",
			"inviteMembers",
			"cancelInvitation",
		]);
	});
});
