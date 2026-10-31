import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { m } from "@/paraglide/messages";
import { ActivityLine } from "./activity-line";
import { ReasoningEntry } from "./reasoning-entry";
import { SearchKnowledgeBase } from "./tools/search-knowledge-base";

afterEach(() => {
	cleanup();
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

	test("keeps announcing while not shown", () => {
		render(<ActivityLine label="Searching" shown={false} />);

		expect(screen.getAllByText("Searching")).toHaveLength(1);
		expect(screen.getByRole("status").textContent).toBe("Searching");
	});
});

describe("ReasoningEntry", () => {
	const part = {
		type: "reasoning",
		text: "a",
		state: "streaming",
	} as const;

	test("thinks only while live", () => {
		const { rerender } = render(<ReasoningEntry part={part} live />);
		expect(screen.getByText(m.chat_work_log_thinking())).toBeTruthy();

		rerender(<ReasoningEntry part={part} live={false} />);
		expect(screen.queryByText(m.chat_work_log_thinking())).toBeNull();
	});

	test("offers the toggle once streamed text overflows the clamped box", () => {
		const { rerender } = render(<ReasoningEntry part={part} live />);
		const text = screen.getByText(part.text);
		const showMore = () =>
			screen.queryByRole("button", {
				name: m.chat_work_log_clamped_text_show_more(),
			});
		expect(showMore()).toBeNull();

		Object.defineProperty(text, "scrollHeight", {
			configurable: true,
			value: 120,
		});
		Object.defineProperty(text, "clientHeight", {
			configurable: true,
			value: 60,
		});
		rerender(
			<ReasoningEntry
				part={{
					...part,
					text: "a longer thought",
				}}
				live
			/>,
		);
		expect(showMore()).not.toBeNull();
	});
});

describe("SearchKnowledgeBase", () => {
	const searchPart = (output: unknown) =>
		({
			type: "tool-searchKnowledgeBase",
			toolCallId: "s1",
			state: "output-available",
			input: {
				query: "refunds",
			},
			output,
		}) as Parameters<typeof SearchKnowledgeBase>[0]["part"];

	test("shows each result's title and text", () => {
		render(
			<SearchKnowledgeBase
				part={searchPart({
					results: [
						{
							ref: "k000001",
							id: "c1",
							assetId: "asset-a",
							title: "Refund policy",
							blockName: "Handbook",
							pageStart: 4,
							pageEnd: 4,
							text: "Refunds are paid within 14 days.",
						},
					],
				})}
				status={null}
			/>,
		);

		expect(
			screen.getByText(
				m.chat_work_log_tool_search_result({
					count: 1,
				}),
			),
		).toBeTruthy();
		expect(screen.getByText("Refund policy")).toBeTruthy();
		expect(screen.getByText("Refunds are paid within 14 days.")).toBeTruthy();
	});

	test("shows an output of an older shape without results", () => {
		render(
			<SearchKnowledgeBase
				part={searchPart({
					results: [
						{
							id: "c1",
							title: "Refund policy",
							snippet: "refunds are paid within 14 days",
						},
					],
				})}
				status={null}
			/>,
		);

		expect(screen.getByText(m.chat_work_log_tool_search_name())).toBeTruthy();
		expect(screen.queryByText("Refund policy")).toBeNull();
	});
});
