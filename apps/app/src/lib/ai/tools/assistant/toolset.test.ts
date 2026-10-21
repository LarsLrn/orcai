import { describe, expect, test } from "bun:test";
import { asSchema, type ToolSet } from "ai";
import { createAssistantSession } from "@/lib/ai/agents/assistant-session";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { GATED_ASSISTANT_TOOLS } from "./approval";
import { CLIENT_TOOL_OUTPUT_SCHEMAS } from "./client-tools";
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
	session: createAssistantSession({
		history: [],
		capabilities: {
			read: true,
		},
		toolLoading: {
			type: "active-tools",
		},
	}),
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

	test("builds updatePlan as a core tool, not a deferred one", () => {
		expect(tools.updatePlan).toBeDefined();
		expect(coreTools).toContain("updatePlan");
		expect(deferredTools as string[]).not.toContain("updatePlan");
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

describe("client tools", () => {
	test("the registry holds exactly the tools without execute, with their output schemas", () => {
		const clientTools = Object.entries(tools).filter(
			([, tool]) => tool.execute === undefined,
		);

		expect(clientTools.map(([name]) => name).sort()).toEqual(
			Object.keys(CLIENT_TOOL_OUTPUT_SCHEMAS).sort(),
		);
		for (const [name, tool] of clientTools) {
			expect(tool.outputSchema).toBe(
				CLIENT_TOOL_OUTPUT_SCHEMAS[
					name as keyof typeof CLIENT_TOOL_OUTPUT_SCHEMAS
				],
			);
		}
	});
});

describe("gated tools", () => {
	test("every gated tool is in the toolset", () => {
		for (const name of GATED_ASSISTANT_TOOLS) {
			expect(Object.keys(tools)).toContain(name);
		}
	});
});
