import { describe, expect, test } from "bun:test";
import { genUiPrompt } from "@/components/chat/gen-ui/prompt";
import type { CitableKind } from "@/lib/ai/citations/citation-rules";
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
			citable: [],
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
			citable: [],
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
			citable: [],
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
				featureCatalog.generativeUi.prompt({
					citations: false,
				}),
			],
			citable: [],
			today: "Friday, 30 October 2026",
		});

		const behaviour = stable.indexOf("<behaviour>");
		const repositories = stable.indexOf(REPOSITORIES);
		const fragment = stable.indexOf(
			genUiPrompt({
				citations: false,
			}),
		);
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
			citable: [],
			today: "Friday, 30 October 2026",
		});

		expect(stable).not.toContain(REPOSITORIES);
		expect(stable).not.toContain(
			genUiPrompt({
				citations: false,
			}),
		);
		expect(stable).toContain(FORMATTING);
	});

	test("cites only in a turn with sources, in the unquoted ref form", () => {
		const cited = buildChatAgentSystemPrompt({
			behaviour: undefined,
			repositories: [
				readings,
			],
			featurePrompts: [],
			citable: [
				"passage",
			],
			today: "Friday, 30 October 2026",
		}).stable;
		const uncited = buildChatAgentSystemPrompt({
			behaviour: undefined,
			repositories: [],
			featurePrompts: [],
			citable: [],
			today: "Friday, 30 October 2026",
		}).stable;

		expect(cited.indexOf("Citations:")).toBeGreaterThan(
			cited.indexOf(REPOSITORIES),
		);
		expect(cited).toContain("<cite ref=kgol9ts>");
		expect(cited).not.toMatch(/<cite [^>]*"|chunk=|k7f3a2/);
		expect(uncited).not.toContain("Citations:");
		expect(uncited).not.toContain("<cite");
	});

	test("names the tag of every kind the turn can cite", () => {
		const prompt = (citable: CitableKind[]) =>
			buildChatAgentSystemPrompt({
				behaviour: undefined,
				repositories: [],
				featurePrompts: [],
				citable,
				today: "Friday, 30 October 2026",
			}).stable;

		expect(
			prompt([
				"attachment",
			]),
		).toContain("- Each <attachment> tag carries a ref, such as ref=au733ur.");
		expect(
			prompt([
				"passage",
				"web",
				"attachment",
			]),
		).toContain(
			"- Each <passage>, <web-result> and <attachment> tag carries a ref, such as ref=kgol9ts.",
		);
	});

	test("lets display tool prose cite only when the turn can cite", () => {
		expect(
			genUiPrompt({
				citations: true,
			}),
		).toContain("Markdown and citations");
		expect(
			genUiPrompt({
				citations: false,
			}),
		).not.toContain("citation");
	});

	test("puts the date in the variable part, so the stable part caches", () => {
		const prompt = buildChatAgentSystemPrompt({
			behaviour: "You check citations.",
			repositories: [],
			featurePrompts: [],
			citable: [],
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
