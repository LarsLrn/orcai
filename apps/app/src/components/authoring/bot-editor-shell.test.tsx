import { afterEach, describe, expect, mock, test } from "bun:test";
import type { BotId } from "@orcai/core";
import type { BotEditor } from "@orcai/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { ConfirmDialogProvider } from "@/components/ui/composed/confirm-dialog";
import { scriptedOrpc } from "@/lib/testing/scripted-orpc";
import { m } from "@/paraglide/messages";

mock.module("@/lib/orpc/orpc", () => scriptedOrpc());

const { BotEditorShell } = await import("./bot-editor-shell");

const bot: BotEditor = {
	id: "00000000-0000-4000-8000-000000000000" as BotId,
	name: "Stored",
	description: "Stored bot",
	contentJson: {},
	status: "draft",
	capabilities: {},
	behaviour: null,
	repositories: [],
	features: {},
};

/** Renders the shell on its second step; each step change waits for the test to settle it. */
const renderShell = async () => {
	const changes: (() => void)[] = [];
	const onStepChange = () => {
		const { promise, resolve } = Promise.withResolvers<void>();
		changes.push(resolve);
		return promise;
	};
	const router = createRouter({
		routeTree: createRootRoute({
			component: () => (
				<BotEditorShell
					editorData={bot}
					stepIndex={1}
					onStepChange={onStepChange}
				/>
			),
		}),
		history: createMemoryHistory(),
		context: {
			auth: {
				isAuthenticated: true,
				session: {},
			},
		},
	});
	render(
		<QueryClientProvider client={new QueryClient()}>
			<ConfirmDialogProvider>
				<RouterProvider router={router} />
			</ConfirmDialogProvider>
		</QueryClientProvider>,
	);
	const next = await screen.findByRole("button", {
		name: m.common_next_button(),
	});
	const back = screen.getByRole("button", {
		name: m.common_back_button(),
	});
	return {
		changes,
		next,
		back,
	};
};

const isDisabled = (button: HTMLElement) =>
	button.hasAttribute("disabled") ||
	button.getAttribute("aria-disabled") === "true";

afterEach(cleanup);

describe("BotEditorShell", () => {
	test("Next and Back wait until the next step is shown", async () => {
		const { changes, next, back } = await renderShell();

		fireEvent.click(next);
		await waitFor(() => expect(changes).toHaveLength(1));
		expect(isDisabled(next)).toBe(true);
		expect(isDisabled(back)).toBe(true);

		// A second click while the step loads would count from the old step.
		fireEvent.click(next);
		expect(changes).toHaveLength(1);

		await act(() => changes[0]?.());
		await waitFor(() => expect(isDisabled(next)).toBe(false));
		expect(isDisabled(back)).toBe(false);
	});
});
