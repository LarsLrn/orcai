import { describe, expect, test } from "bun:test";
import { chatCallSettings } from "./chat-call-settings";

describe("chatCallSettings", () => {
	test("an unset config sets nothing", () => {
		expect(chatCallSettings(undefined)).toStrictEqual({});
		expect(chatCallSettings(null)).toStrictEqual({});
		expect(
			chatCallSettings({
				systemPrompt: "Be brief.",
			}),
		).toStrictEqual({});
	});

	test("only the configured parameters are set", () => {
		expect(
			chatCallSettings({
				temperature: 0,
				maxTokens: 512,
			}),
		).toStrictEqual({
			temperature: 0,
			maxOutputTokens: 512,
		});
		expect(
			chatCallSettings({
				topP: 0.9,
				frequencyPenalty: 0,
				presencePenalty: -0.5,
			}),
		).toStrictEqual({
			topP: 0.9,
			frequencyPenalty: 0,
			presencePenalty: -0.5,
		});
	});
});
