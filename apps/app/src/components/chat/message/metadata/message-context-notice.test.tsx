import { afterEach, describe, expect, test } from "bun:test";
import type { ChatMessageMetadata } from "@orcai/schema";
import { cleanup, render, screen } from "@testing-library/react";
import type { ChatAgentUIMessage } from "@/lib/ai/messages/chat-agent-message";
import { m } from "@/paraglide/messages";
import { MessageContextNotice } from "./message-context-notice";

afterEach(() => {
	cleanup();
});

const reply = (metadata: ChatMessageMetadata) =>
	({
		id: "reply",
		role: "assistant",
		parts: [
			{
				type: "text",
				text: "The first half",
			},
		],
		metadata,
	}) as ChatAgentUIMessage;

describe("MessageContextNotice", () => {
	test("says a cut-off reply was cut off", () => {
		render(
			<MessageContextNotice
				message={reply({
					interrupted: true,
				})}
			/>,
		);

		expect(screen.getByText(m.chat_message_interrupted())).toBeDefined();
	});

	test("shows nothing under a finished reply", () => {
		const { container } = render(
			<MessageContextNotice
				message={reply({
					model: "claude-opus-5-5",
				})}
			/>,
		);

		expect(container.textContent).toBe("");
	});
});
