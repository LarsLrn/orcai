import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	orpc: {},
}));

const { MessageResponse } = await import("./message");
const { CitationsContext } = await import("./cite");

const citations = {
	k7f3a2: {
		assetId: "9b2d4c6e-1f3a-4b5c-8d7e-0a1b2c3d4e5f",
		title: "Refund policy.pdf",
		page: 4,
	},
};

const renderAnswer = (markdown: string) =>
	render(
		<CitationsContext value={citations}>
			<MessageResponse>{markdown}</MessageResponse>
		</CitationsContext>,
	);

afterEach(cleanup);

describe("CiteComponent", () => {
	test("names the source of a chunk ref from the message's citations", async () => {
		renderAnswer('Paid <cite chunk="k7f3a2">within 14 days</cite>.');

		await waitFor(() =>
			expect(
				screen.getByRole("button", {
					name: "Refund policy · p. 4",
				}),
			).toBeTruthy(),
		);
		expect(screen.getByText("within 14 days")).toBeTruthy();
	});

	test("names the source an older answer's attributes give", async () => {
		renderAnswer(
			'Paid <cite assetid="9b2d4c6e-1f3a-4b5c-8d7e-0a1b2c3d4e5f" title="Travel policy" page="2">by train</cite>.',
		);

		await waitFor(() =>
			expect(
				screen.getByRole("button", {
					name: "Travel policy · p. 2",
				}),
			).toBeTruthy(),
		);
	});

	test("shows an unknown ref as plain text", async () => {
		const { container } = renderAnswer(
			'Paid <cite chunk="k000000">soon</cite>.',
		);

		await waitFor(() => expect(container.textContent).toContain("soon"));
		expect(screen.queryByRole("button")).toBeNull();
	});
});
