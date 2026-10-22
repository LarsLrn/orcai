import type { Locator, Page } from "@playwright/test";
import type { JsonValue, ScriptedToolCall } from "../inference/fixture";
import { message } from "../messages";

export const QUESTIONS = {
	questions: {},
};

/** An askUser call with this input. */
export const askUserCall = (input: JsonValue): ScriptedToolCall => ({
	name: "askUser",
	input,
});

/** The round of questions headed by `title` in the conversation. */
export const questionsCard = (page: Page, title: string): Locator =>
	page.getByRole("log").getByRole("region", {
		name: title,
		exact: true,
	});

/** A button of a round of questions, by its message key. */
export const questionsButton = (card: Locator, key: string): Locator =>
	card.getByRole("button", {
		name: message(key),
		exact: true,
	});

export const option = (
	card: Locator,
	role: "radio" | "checkbox",
	name: string,
) =>
	card.getByRole(role, {
		name,
		exact: true,
	});
