import { describe, expect, test } from "bun:test";
import { NATIVE_WEB_SEARCH_TOOL_NAME, providerCompaction } from "@orcai/ai";
import { asSchema, type ToolSet } from "ai";
import * as Effect from "effect/Effect";
import { buildGenUiTools } from "@/components/chat/gen-ui/catalog";
import { createAssistantSession } from "@/lib/ai/agents/assistant-session";
import { chatSources } from "@/lib/ai/citations/chat-sources";
import { featureCatalog } from "@/lib/ai/features/catalog";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import "./assistant/test-procedures";
import { createAssistantTurn } from "./assistant/turn-state";
import { buildQuestionTools } from "./questions/toolset";
import { buildRepositoryTools } from "./rag/toolset";
import { storedWebSearchTools } from "./web/toolset";

const { buildAssistantTools } = await import("./assistant/toolset");

const context = {
	secureCookies: false,
} as ORPCContext;

const assistantTools: ToolSet = buildAssistantTools({
	context,
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

const featureTools: ToolSet = Object.assign(
	{},
	...Object.values(featureCatalog).map((entry) =>
		entry.buildTools({
			context,
			settings: {
				allowedDomains: [],
			},
			turn: {
				webSearch: {
					kind: "provider",
					search: () => Effect.succeed([]),
				},
				history: [],
				citations: true,
			},
		}),
	),
);

// The native search call is the provider's, which never validates it.
const { [NATIVE_WEB_SEARCH_TOOL_NAME]: _, ...chatTools }: ToolSet = {
	...buildRepositoryTools({
		blocks: [],
		context,
		sources: chatSources([]),
	}),
	...buildGenUiTools({
		citations: true,
	}),
	...buildQuestionTools({
		history: [],
	}),
	...storedWebSearchTools(),
	...featureTools,
};

const everyTool = Object.entries({
	...chatTools,
	...assistantTools,
});

/** Open keys are missing, `true` or `{}`; a record's value schema closes them. */
const isOpen = (additionalProperties: unknown) =>
	additionalProperties === undefined ||
	additionalProperties === true ||
	(typeof additionalProperties === "object" &&
		additionalProperties !== null &&
		Object.keys(additionalProperties).length === 0);

/** The JSON paths of every object node that leaves its keys open. */
const openObjects = (node: unknown, path = "$"): string[] => {
	if (Array.isArray(node)) {
		return node.flatMap((item, index) =>
			openObjects(item, `${path}[${index}]`),
		);
	}
	if (typeof node !== "object" || node === null) {
		return [];
	}

	const own =
		"type" in node &&
		node.type === "object" &&
		isOpen(
			"additionalProperties" in node ? node.additionalProperties : undefined,
		)
			? [
					path,
				]
			: [];

	return [
		...own,
		...Object.entries(node).flatMap(([key, value]) =>
			openObjects(value, `${path}.${key}`),
		),
	];
};

describe("every tool's input", () => {
	test("covers the chat and assistant tools", () => {
		expect(everyTool.length).toBeGreaterThan(40);
	});

	test.each(everyTool)("%s advertises only closed objects", async (_, tool) => {
		expect(openObjects(await asSchema(tool.inputSchema).jsonSchema)).toEqual(
			[],
		);
	});

	test.each(everyTool)(
		"%s refuses a key it does not name, naming it",
		async (_, tool) => {
			const result = await asSchema(tool.inputSchema).validate?.({
				unknownKey: true,
			});

			expect(result?.success).toBe(false);
			expect(result?.success === false && result.error.message).toContain(
				"unknownKey",
			);
		},
	);
});
