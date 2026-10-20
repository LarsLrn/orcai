import { describe, expect, test } from "bun:test";
import { asSchema, type ToolSet } from "ai";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { assistantToolApproval, GATED_ASSISTANT_TOOLS } from "./approval";
import { ASSISTANT_TOOL_GROUPS, DEFERRED_TOOL_GROUPS } from "./groups";
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
	capabilities: {
		read: true,
	},
});

/** Core tools the toolset builds; readDocs and the display tools come from the agent. */
const coreTools = ASSISTANT_TOOL_GROUPS.core.filter(
	(name) => name !== "readDocs" && !name.startsWith("show"),
);
const deferredTools = DEFERRED_TOOL_GROUPS.flatMap(
	(group) => ASSISTANT_TOOL_GROUPS[group],
);

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
	test("builds every core and deferred tool", () => {
		expect(Object.keys(tools).sort()).toEqual(
			[
				...coreTools,
				...deferredTools,
			].sort(),
		);
	});

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
});

describe("assistantToolApproval", () => {
	test("gates exactly the twelve confirming tools", () => {
		expect(Object.keys(assistantToolApproval).sort()).toEqual(
			[
				"deleteBot",
				"deleteBlock",
				"deleteAsset",
				"deleteGroup",
				"revokeAccess",
				"removeGroupMembers",
				"removeMembers",
				"cancelInvitation",
				"grantAccess",
				"addGroupMembers",
				"changeMemberRole",
				"inviteMembers",
			].sort(),
		);
		expect(new Set(Object.values(assistantToolApproval))).toEqual(
			new Set([
				"user-approval",
			]),
		);
	});

	test("every gated tool is in the toolset", () => {
		for (const name of GATED_ASSISTANT_TOOLS) {
			expect(Object.keys(tools)).toContain(name);
		}
	});
});
