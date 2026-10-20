import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { WorkEntry } from "@/components/chat/message/classify-turn";
import { m } from "@/paraglide/messages";
import { ActivityLine } from "./activity-line";
import { activeStepLabel } from "./work-log";

afterEach(() => {
	cleanup();
});

const searchEntry = (state: string) =>
	({
		id: "0",
		kind: "tool",
		part: {
			type: "tool-searchKnowledgeBase",
			toolCallId: "call-1",
			state,
			input: {
				query: "x",
			},
		},
	}) as unknown as WorkEntry;

const reasoningEntry = (state: string) =>
	({
		id: "1",
		kind: "reasoning",
		part: {
			type: "reasoning",
			text: "a",
			state,
		},
	}) as unknown as WorkEntry;

describe("activeStepLabel", () => {
	test("names a running tool call by its active label", () => {
		expect(
			activeStepLabel(
				[
					searchEntry("input-available"),
				],
				true,
			),
		).toBe(m.chat_work_log_tool_search_active());
	});

	test("names streaming reasoning as thinking", () => {
		expect(
			activeStepLabel(
				[
					searchEntry("output-available"),
					reasoningEntry("streaming"),
				],
				true,
			),
		).toBe(m.chat_work_log_thinking());
	});

	test("is null between steps and once the turn ends", () => {
		expect(
			activeStepLabel(
				[
					searchEntry("output-available"),
				],
				true,
			),
		).toBeNull();
		expect(
			activeStepLabel(
				[
					searchEntry("input-available"),
				],
				false,
			),
		).toBeNull();
	});
});

describe("ActivityLine", () => {
	test("shows the steps when clicked", () => {
		const onShowSteps = mock(() => undefined);
		render(<ActivityLine label="Searching" onShowSteps={onShowSteps} />);

		fireEvent.click(
			screen.getByRole("button", {
				name: "Searching",
			}),
		);

		expect(onShowSteps).toHaveBeenCalledTimes(1);
	});

	test("is plain text without steps to show", () => {
		render(<ActivityLine label="Working" />);

		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getAllByText("Working")).toHaveLength(2);
	});

	test("announces each new label once through a polite live region", () => {
		const { rerender } = render(<ActivityLine label="Searching" />);
		const status = screen.getByRole("status");
		expect(status.getAttribute("aria-live")).toBe("polite");
		expect(status.textContent).toBe("Searching");

		rerender(<ActivityLine label={null} />);
		expect(screen.getAllByText("Searching")).toHaveLength(1);
		expect(screen.getByRole("status").textContent).toBe("Searching");

		rerender(<ActivityLine label="Searching" />);
		expect(screen.getByRole("status")).toBe(status);
		expect(status.textContent).toBe("Searching");

		rerender(<ActivityLine label="Thinking" />);
		expect(status.textContent).toBe("Thinking");
	});
});
