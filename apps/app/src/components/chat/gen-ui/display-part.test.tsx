import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { DisplayToolPart } from "@/components/chat/gen-ui/display-part";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	orpc: {},
}));

const { DisplayPart } = await import("@/components/chat/gen-ui/display-part");

afterEach(cleanup);

const checklistPart = (
	state: DisplayToolPart["state"],
	input: unknown,
): DisplayToolPart => ({
	type: "tool-showChecklist",
	state,
	input,
});

const validInput = {
	title: "APA 7 check",
	items: [
		{
			label: "Shute (2008)",
			status: "partial",
			summary: "Source",
		},
	],
};

describe("DisplayPart", () => {
	test("renders valid stored input as the checklist", () => {
		const { container } = render(
			<DisplayPart
				part={checklistPart("output-available", validInput)}
				running={false}
			/>,
		);

		expect(
			screen.getByRole("heading", {
				name: "APA 7 check",
			}),
		).toBeDefined();
		expect(
			container.querySelector('[data-slot="collapsible-trigger"]'),
		).not.toBeNull();
	});

	test("renders partial input while streaming", () => {
		const { container } = render(
			<DisplayPart
				part={checklistPart("input-streaming", {
					title: "APA 7 check",
				})}
				running
			/>,
		);

		expect(screen.getByText("APA 7 check")).toBeDefined();
		expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
	});

	test("renders invalid stored input through toMarkdown", async () => {
		const { container } = render(
			<DisplayPart
				part={checklistPart("output-available", {
					title: "APA 7 check",
					items: [
						{
							label: "Shute (2008)",
							status: "almost",
						},
					],
				})}
				running={false}
			/>,
		);

		await waitFor(() =>
			expect(container.querySelector("li")?.textContent).toBe("Shute (2008)"),
		);
		expect(
			container.querySelector('[data-slot="collapsible-trigger"]'),
		).toBeNull();
		expect(screen.getByText("APA 7 check")).toBeDefined();
	});

	test("validates a part that stopped streaming", async () => {
		const { container } = render(
			<DisplayPart
				part={checklistPart("input-streaming", {
					title: "Cut off",
				})}
				running={false}
			/>,
		);

		await waitFor(() =>
			expect(container.querySelector("h3")?.textContent).toBe("Cut off"),
		);
		expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
	});

	test.each([
		{},
		{
			items: "not a list",
		},
		undefined,
	])("renders the can't display note for %p", (input) => {
		render(
			<DisplayPart
				part={checklistPart("input-available", input)}
				running={false}
			/>,
		);

		expect(screen.getByText("This result can't be displayed.")).toBeDefined();
	});

	test("renders nothing for a failed call", () => {
		const { container } = render(
			<DisplayPart
				part={checklistPart("output-error", validInput)}
				running={false}
			/>,
		);

		expect(container.innerHTML).toBe("");
	});
});
