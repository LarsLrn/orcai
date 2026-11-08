import { describe, expect, mock, test } from "bun:test";
import type { BotId } from "@orcai/core";
import type { BotEditor } from "@orcai/schema";
import { scriptedOrpc } from "@/lib/testing/scripted-orpc";

mock.module("@/lib/orpc/orpc", () => scriptedOrpc());

const { toBotEditorFormValues } = await import(
	"@/components/authoring/bot-editor-form-options"
);

const storedBot = (features: BotEditor["features"]): BotEditor => ({
	id: "00000000-0000-4000-8000-000000000000" as BotId,
	name: "Stored",
	description: "Stored bot",
	contentJson: {},
	status: "draft",
	capabilities: {},
	behaviour: null,
	repositories: [],
	features,
});

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
