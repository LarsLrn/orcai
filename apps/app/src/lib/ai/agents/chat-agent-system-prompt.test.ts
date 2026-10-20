import { describe, expect, test } from "bun:test";
import { genUiPrompt } from "@/components/chat/gen-ui/prompt";
import { featureCatalog } from "@/lib/ai/features/catalog";
import { buildChatAgentSystemPrompt } from "./chat-agent-system-prompt";

const KNOWLEDGE_BASE = "Knowledge-base retrieval workflow:";
const FORMATTING = "Message formatting and styling:";

describe("buildChatAgentSystemPrompt", () => {
	test("places the Generative UI fragment between knowledge-base and formatting guidance", () => {
		const prompt = buildChatAgentSystemPrompt({
			systemPrompt: "You check citations.",
			hasKnowledgeBaseBlocks: true,
			featurePrompts: [
				featureCatalog.generativeUi.prompt,
			],
		});

		const knowledgeBase = prompt.indexOf(KNOWLEDGE_BASE);
		const fragment = prompt.indexOf(genUiPrompt);
		const formatting = prompt.indexOf(FORMATTING);

		expect(prompt.startsWith("You check citations.")).toBe(true);
		expect(knowledgeBase).toBeGreaterThan(0);
		expect(fragment).toBeGreaterThan(knowledgeBase);
		expect(formatting).toBeGreaterThan(fragment);
	});

	test("places the fragment before formatting guidance without repositories", () => {
		const prompt = buildChatAgentSystemPrompt({
			systemPrompt: "You check citations.",
			hasKnowledgeBaseBlocks: false,
			featurePrompts: [
				featureCatalog.generativeUi.prompt,
			],
		});

		expect(prompt).not.toContain(KNOWLEDGE_BASE);
		expect(prompt.indexOf(genUiPrompt)).toBeGreaterThan(0);
		expect(prompt.indexOf(FORMATTING)).toBeGreaterThan(
			prompt.indexOf(genUiPrompt),
		);
	});

	test("leaves the fragment out when Generative UI is off", () => {
		const prompt = buildChatAgentSystemPrompt({
			systemPrompt: "You check citations.",
			hasKnowledgeBaseBlocks: true,
			featurePrompts: [],
		});

		expect(prompt).not.toContain(genUiPrompt);
		expect(prompt).toContain(KNOWLEDGE_BASE);
		expect(prompt).toContain(FORMATTING);
	});
});
