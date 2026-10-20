import { describe, expect, test } from "bun:test";
import { displayToolMarkdown } from "@/components/chat/gen-ui/catalog";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import {
	messageToMarkdown,
	messageToTranscriptMarkdown,
} from "./message-markdown";

const checklistInput = {
	title: "Citation style",
	items: [
		{
			label: "Author names",
			status: "met",
			summary: "All authors are listed.",
		},
	],
};

const message = (role: "user" | "assistant", parts: unknown[]) =>
	({
		id: "message-1",
		role,
		parts,
	}) as unknown as ChatAgentUIMessage;

const text = (content: string) => ({
	type: "text",
	text: content,
	state: "done",
});

describe("messageToMarkdown", () => {
	test("walks the answer's text and display parts in order", () => {
		const markdown = messageToMarkdown(
			message("assistant", [
				{
					type: "reasoning",
					text: "thinking",
					state: "done",
				},
				text("let me look"),
				{
					type: "tool-searchKnowledgeBase",
					toolCallId: "call-1",
					state: "output-available",
					input: {
						query: "x",
					},
					output: {
						results: [],
					},
				},
				text("Lead-in"),
				{
					type: "tool-showChecklist",
					toolCallId: "call-2",
					state: "output-available",
					input: checklistInput,
					output: {
						shown: true,
					},
				},
				text("Conclusion"),
			]),
		);

		expect(markdown).toContain("Citation style");
		expect(markdown).toBe(
			[
				"Lead-in",
				displayToolMarkdown("showChecklist", checklistInput),
				"Conclusion",
			].join("\n\n"),
		);
	});

	test("user messages join all their text parts", () => {
		expect(
			messageToMarkdown(
				message("user", [
					text("First"),
					{
						type: "file",
						mediaType: "image/png",
						url: "data:,",
					},
					text("Second"),
				]),
			),
		).toBe("First\n\nSecond");
	});
});

describe("messageToTranscriptMarkdown", () => {
	test("puts the role on its own paragraph before a code fence", () => {
		expect(
			messageToTranscriptMarkdown(
				message("assistant", [
					text("```ts\nconst a = 1;\n```"),
				]),
			),
		).toBe("**Assistant:**\n\n```ts\nconst a = 1;\n```");
	});

	test("puts the role on its own paragraph before a list", () => {
		expect(
			messageToTranscriptMarkdown(
				message("user", [
					text("- first\n- second"),
				]),
			),
		).toBe("**User:**\n\n- first\n- second");
	});
});
