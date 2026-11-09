import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { ComposerPanel } from "./composer-panel";

afterEach(() => {
	cleanup();
});

const panel = (open: boolean) =>
	render(
		<ComposerPanel
			label="Plan"
			icon={null}
			title="Set up the bot"
			tally="1/3"
			summary="Upload the handbook"
			open={open}
			onOpenChange={() => undefined}
			expandLabel="Expand"
			collapseLabel="Collapse"
			footer={<p>Approve?</p>}
		>
			<p>Body</p>
		</ComposerPanel>,
	);

describe("ComposerPanel", () => {
	test("a collapsed panel shows title, tally, summary and footer, not the body", () => {
		panel(false);

		expect(
			screen.getByRole("region", {
				name: "Plan",
			}),
		).toBeTruthy();
		expect(
			screen.getByRole("button", {
				name: /Set up the bot.*1\/3.*Upload the handbook.*Expand/,
			}),
		).toBeTruthy();
		expect(screen.getByText("Approve?")).toBeTruthy();
		expect(screen.queryByText("Body")).toBeNull();
	});

	test("an open panel shows the body and drops the summary", () => {
		panel(true);

		expect(screen.getByText("Body")).toBeTruthy();
		expect(screen.queryByText("Upload the handbook")).toBeNull();
		expect(screen.getByText("Collapse")).toBeTruthy();
	});
});
