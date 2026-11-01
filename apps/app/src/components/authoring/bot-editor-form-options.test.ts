import { describe, expect, mock, test } from "bun:test";
import type { BotEditor } from "@orcai/schema";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	client: {},
	orpc: {},
}));

const { toBotEditorFormValues } = await import(
	"@/components/authoring/bot-editor-form-options"
);

const storedBot = (features: BotEditor["features"]) =>
	({
		id: "00000000-0000-4000-8000-000000000000",
		name: "Stored",
		description: "Stored bot",
		contentJson: {},
		status: "draft",
		capabilities: {},
		templateBlock: null,
		databaseBlocks: [],
		features,
	}) as unknown as BotEditor;

describe("toBotEditorFormValues", () => {
	test("a new bot starts with Generative UI on", () => {
		expect(toBotEditorFormValues().features).toEqual({
			generativeUi: {},
		});
	});

	test("an existing bot keeps its stored features", () => {
		expect(toBotEditorFormValues(storedBot({})).features).toEqual({});
		expect(
			toBotEditorFormValues(
				storedBot({
					generativeUi: {},
				}),
			).features,
		).toEqual({
			generativeUi: {},
		});
	});
});
