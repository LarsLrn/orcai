import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	orpc: {},
}));

const { MessageResponse } = await import("./message");

const renderItems = async (markdown: string) => {
	const { container } = render(<MessageResponse>{markdown}</MessageResponse>);
	await waitFor(() => expect(container.querySelector("li")).not.toBeNull());
	return {
		items: [
			...container.querySelectorAll("li"),
		],
	};
};

const childTags = (element: Element) =>
	[
		...element.children,
	].map((child) => child.tagName.toLowerCase());

afterEach(cleanup);

describe("MessageResponse lists", () => {
	test("keeps each paragraph of a loose list item as its own block", async () => {
		const { items } = await renderItems(
			"- First paragraph\n\n  Second paragraph\n- Next item",
		);

		expect(childTags(items[0])).toEqual([
			"p",
			"p",
		]);
		expect(items[0].children[0].textContent).toBe("First paragraph");
		expect(items[0].children[1].textContent).toBe("Second paragraph");
	});

	test("renders tight list items without paragraphs", async () => {
		const { items } = await renderItems("- Alpha\n- Beta\n- Gamma");

		expect(items.map((item) => item.textContent)).toEqual([
			"Alpha",
			"Beta",
			"Gamma",
		]);
		for (const item of items) {
			expect(childTags(item)).toEqual([]);
		}
	});
});
