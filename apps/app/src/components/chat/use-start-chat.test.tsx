import { afterEach, describe, expect, test } from "bun:test";
import type { ChatId } from "@orcai/core";
import type { ChatKind } from "@orcai/schema";
import { QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Toaster, toast } from "sonner";
import type { ChatDraft } from "@/components/chat/chat-draft";
import { createQueryClient } from "@/lib/orpc/query-client";
import { useStartChat } from "./use-start-chat";

const draft: ChatDraft = {
	text: "Plan my week",
	attachments: [],
};

let start: (draft: ChatDraft) => Promise<boolean> = () =>
	Promise.reject(new Error("Not rendered"));

const Starter = ({
	create,
}: {
	create: () => Promise<{
		data: {
			id: ChatId;
			kind: ChatKind;
		};
		meta: {
			zedToken?: string;
		};
	}>;
}) => {
	const { start: startChat } = useStartChat<void>({
		create: {
			mutationFn: create,
		},
		errorToast: "Could not start",
	});
	start = (message) => startChat(undefined, message);
	return <Outlet />;
};

const renderStarter = async (
	create: Parameters<typeof Starter>[0]["create"],
) => {
	const root = createRootRoute({
		component: () => <Starter create={create} />,
	});
	const routes = [
		"/",
		"/app/chat/$chatId",
		"/app/assistant/$chatId",
	].map((path) =>
		createRoute({
			getParentRoute: () => root,
			path,
			component: () => null,
		}),
	);
	const router = createRouter({
		routeTree: root.addChildren(routes),
		history: createMemoryHistory({
			initialEntries: [
				"/",
			],
		}),
	});
	render(
		<QueryClientProvider client={createQueryClient()}>
			<RouterProvider router={router} />
			<Toaster />
		</QueryClientProvider>,
	);
	await act(() => router.load());
	return router;
};

// Sonner keeps its toasts in a module-level store.
afterEach(() => {
	cleanup();
	toast.dismiss();
});

describe("useStartChat", () => {
	test("a started conversation opens in its kind's route with the draft to send", async () => {
		const id = crypto.randomUUID() as ChatId;
		const router = await renderStarter(async () => ({
			data: {
				id,
				kind: "assistant",
			},
			meta: {
				zedToken: "token-1",
			},
		}));

		let started: boolean | undefined;
		await act(async () => {
			started = await start(draft);
		});

		expect(started).toBe(true);
		expect(router.state.location.pathname).toBe(`/app/assistant/${id}`);
		expect(router.state.location.search).toEqual({
			zedToken: "token-1",
		});
		expect(router.state.location.state.pendingMessage).toEqual(draft);
	});

	test("a chat that cannot be created stays put and shows the start failure once", async () => {
		const router = await renderStarter(() =>
			Promise.reject(new Error("Server down")),
		);

		let started: boolean | undefined;
		await act(async () => {
			started = await start(draft);
		});

		expect(started).toBe(false);
		expect(router.state.location.pathname).toBe("/");
		expect(await screen.findAllByText("Could not start")).toHaveLength(1);
	});
});
