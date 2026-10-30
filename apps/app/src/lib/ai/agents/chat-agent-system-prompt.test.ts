import { describe, expect, test } from "bun:test";
import { genUiPrompt } from "@/components/chat/gen-ui/prompt";
import { featureCatalog } from "@/lib/ai/features/catalog";
import {
	buildChatAgentSystemPrompt,
	localDate,
} from "./chat-agent-system-prompt";

const REPOSITORIES = "Repositories:";
const FORMATTING = "Formatting:";

const readings = {
	id: "0d8c6f5e-7b1a-4c2e-9f3d-2a1b0c9d8e7f",
	name: 'Course "readings"',
};

describe("buildChatAgentSystemPrompt", () => {
	test("puts the behaviour in its own section after the rules on precedence", () => {
		const { stable } = buildChatAgentSystemPrompt({
			behaviour: "  You check citations.  ",
			repositories: [],
			featurePrompts: [],
			today: "Friday, 30 October 2026",
		});

		expect(stable).toContain(
			"Behaviour:\n<behaviour>\nYou check citations.\n</behaviour>",
		);
		expect(stable.indexOf("follow OrcAI's rule")).toBeLessThan(
			stable.indexOf("<behaviour>"),
		);
		expect(stable).toContain("unless the behaviour sets the answer language");
	});

	test("leaves the behaviour section and its precedence out without a behaviour", () => {
		const { stable } = buildChatAgentSystemPrompt({
			behaviour: " ",
			repositories: [],
			featurePrompts: [],
			today: "Friday, 30 October 2026",
		});

		expect(stable).not.toContain("<behaviour>");
		expect(stable).not.toContain("Behaviour section");
		expect(stable).toContain(
			"Answer in the language of the user's latest message.",
		);
	});

	test("names each repository as quoted data with its id", () => {
		const { stable } = buildChatAgentSystemPrompt({
			behaviour: "You check citations.",
			repositories: [
				readings,
			],
			featurePrompts: [],
			today: "Friday, 30 October 2026",
		});

		expect(stable).toContain(`"Course \\"readings\\"" (id ${readings.id})`);
	});

	test("orders behaviour, repositories, the Generative UI fragment and formatting", () => {
		const { stable } = buildChatAgentSystemPrompt({
			behaviour: "You check citations.",
			repositories: [
				readings,
			],
			featurePrompts: [
				featureCatalog.generativeUi.prompt,
			],
			today: "Friday, 30 October 2026",
		});

		const behaviour = stable.indexOf("<behaviour>");
		const repositories = stable.indexOf(REPOSITORIES);
		const fragment = stable.indexOf(genUiPrompt);
		const formatting = stable.indexOf(FORMATTING);

		expect(behaviour).toBeGreaterThan(0);
		expect(repositories).toBeGreaterThan(behaviour);
		expect(fragment).toBeGreaterThan(repositories);
		expect(formatting).toBeGreaterThan(fragment);
	});

	test("leaves the retrieval rules and the fragment out when neither applies", () => {
		const { stable } = buildChatAgentSystemPrompt({
			behaviour: "You check citations.",
			repositories: [],
			featurePrompts: [],
			today: "Friday, 30 October 2026",
		});

		expect(stable).not.toContain(REPOSITORIES);
		expect(stable).not.toContain(genUiPrompt);
		expect(stable).toContain(FORMATTING);
	});

	test("puts the date in the variable part, so the stable part caches", () => {
		const prompt = buildChatAgentSystemPrompt({
			behaviour: "You check citations.",
			repositories: [],
			featurePrompts: [],
			today: "Friday, 30 October 2026",
		});

		expect(prompt.stable).not.toContain("2026");
		expect(prompt.variable).toBe(
			"Today's date for the user: Friday, 30 October 2026.",
		);
	});
});

describe("localDate", () => {
	const lateEvening = new Date("2026-10-30T23:30:00Z");

	test("is the date in the user's time zone", () => {
		expect(localDate("Europe/Berlin", lateEvening)).toBe(
			"Saturday, 31 October 2026",
		);
		expect(localDate("America/New_York", lateEvening)).toBe(
			"Friday, 30 October 2026",
		);
	});

	test("falls back to UTC for a missing or unknown time zone", () => {
		expect(localDate(undefined, lateEvening)).toBe("Friday, 30 October 2026");
		expect(localDate("Mars/Olympus_Mons", lateEvening)).toBe(
			"Friday, 30 October 2026",
		);
	});
});
