import { afterEach, describe, expect, test } from "bun:test";
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
import { useState } from "react";
import { z } from "zod/v4";
import { m } from "@/paraglide/messages";
import { DataTableSearch } from "./data-table-search";
import { dataTableQuerySchema } from "./data-table-search-params";

const DEBOUNCE_MS = 20;
const LOADER_MS = 60;
const SETTLE_MS = DEBOUNCE_MS + LOADER_MS * 3;

const sleep = (ms: number) =>
	act(() => new Promise((resolve) => setTimeout(resolve, ms)));

const Searches = ({ twice }: { twice: boolean }) => {
	const [mounted, setMounted] = useState(true);
	return (
		<>
			<button type="button" onClick={() => setMounted(false)}>
				unmount
			</button>
			{mounted ? <DataTableSearch debounceMs={DEBOUNCE_MS} /> : null}
			{mounted && twice ? <DataTableSearch debounceMs={DEBOUNCE_MS} /> : null}
		</>
	);
};

// Wired like the list routes: the schema trims the query and a loader delays
// every navigation.
const renderSearch = async ({
	twice = false,
	initialEntry = "/",
}: {
	twice?: boolean;
	initialEntry?: string;
} = {}) => {
	const rootRoute = createRootRoute({
		validateSearch: z.object({
			query: dataTableQuerySchema.default(""),
			pageIndex: z.number().default(0),
		}),
		loaderDeps: ({ search }) => search,
		loader: () => new Promise((resolve) => setTimeout(resolve, LOADER_MS)),
		component: () => <Searches twice={twice} />,
	});
	const router = createRouter({
		routeTree: rootRoute,
		history: createMemoryHistory({
			initialEntries: [
				initialEntry,
			],
		}),
	});
	render(<RouterProvider router={router} />);
	const inputs = await screen.findAllByRole<HTMLInputElement>("textbox");
	const urlQuery = () =>
		(
			router.state.location.search as {
				query?: string;
			}
		).query ?? "";
	const navigateTo = (query: string, replace = false) =>
		act(() =>
			router.navigate({
				to: ".",
				search: {
					query,
				},
				replace,
			}),
		);
	return {
		input: inputs[0] as HTMLInputElement,
		inputs,
		router,
		urlQuery,
		navigateTo,
	};
};

const type = async (input: HTMLInputElement, text: string, delayMs = 5) => {
	for (const character of text) {
		fireEvent.change(input, {
			target: {
				value: input.value + character,
			},
		});
		await sleep(delayMs);
	}
};

// Types without a pause, so no debounce can fire in between.
const fill = (input: HTMLInputElement, text: string) =>
	fireEvent.change(input, {
		target: {
			value: input.value + text,
		},
	});

afterEach(cleanup);

describe("DataTableSearch", () => {
	test("keeps keystrokes typed while a debounced navigation loads", async () => {
		const { input, urlQuery } = await renderSearch();

		await type(input, "alp", DEBOUNCE_MS * 2);
		await type(input, "ha centauri");
		await sleep(SETTLE_MS);

		expect(input.value).toBe("alpha centauri");
		expect(urlQuery()).toBe("alpha centauri");
	});

	test("keeps a trailing space the URL trims away", async () => {
		const { input, urlQuery } = await renderSearch();

		await type(input, "beta ");
		await sleep(SETTLE_MS);
		await type(input, "inc");
		await sleep(SETTLE_MS);

		expect(input.value).toBe("beta inc");
		expect(urlQuery()).toBe("beta inc");
	});

	test("adopts a query changed from outside", async () => {
		const { input, urlQuery, navigateTo } = await renderSearch();

		await type(input, "gamma");
		await waitFor(() => expect(urlQuery()).toBe("gamma"));
		await navigateTo("delta");

		await waitFor(() => expect(input.value).toBe("delta"));
	});

	test("adopts a query replaced from outside", async () => {
		const { input, urlQuery, navigateTo } = await renderSearch();

		await type(input, "gamma");
		await waitFor(() => expect(urlQuery()).toBe("gamma"));
		await navigateTo("delta", true);

		await waitFor(() => expect(input.value).toBe("delta"));
	});

	test("adopts the query of a history entry gone forward to", async () => {
		const { input, router, urlQuery, navigateTo } = await renderSearch();

		await navigateTo("iota");
		await act(() => router.history.back());
		await waitFor(() => expect(input.value).toBe(""));
		fill(input, "kappa");
		await act(() => router.history.forward());
		await sleep(SETTLE_MS);

		expect(input.value).toBe("iota");
		expect(urlQuery()).toBe("iota");
	});

	test("drops a pending query when the filters are cleared while typing", async () => {
		const { input, urlQuery, navigateTo } = await renderSearch({
			initialEntry: "/?pageIndex=2",
		});

		fill(input, "eps");
		await navigateTo("");
		await sleep(SETTLE_MS);

		expect(input.value).toBe("");
		expect(urlQuery()).toBe("");
	});

	test("adopts a history entry whose query matches a pending one", async () => {
		const { input, router, urlQuery, navigateTo } = await renderSearch();

		await navigateTo("ab");
		await navigateTo("");
		await type(input, "ab");
		await sleep(DEBOUNCE_MS * 2);
		fill(input, "c");
		await act(() => router.history.back());
		await sleep(SETTLE_MS);

		expect(input.value).toBe("ab");
		expect(urlQuery()).toBe("ab");
	});

	test("keeps two searches on the same query in step", async () => {
		const { inputs, urlQuery } = await renderSearch({
			twice: true,
		});
		const [first, second] = inputs as [
			HTMLInputElement,
			HTMLInputElement,
		];

		await type(first, "zeta");
		await sleep(SETTLE_MS);

		expect(urlQuery()).toBe("zeta");
		expect(first.value).toBe("zeta");
		expect(second.value).toBe("zeta");
	});

	test("waits for a composition to end", async () => {
		const { input, urlQuery } = await renderSearch();

		fireEvent.compositionStart(input);
		await type(input, "にほん", DEBOUNCE_MS * 2);
		expect(urlQuery()).toBe("");

		fireEvent.change(input, {
			target: {
				value: "日本",
			},
		});
		fireEvent.compositionEnd(input);
		await sleep(SETTLE_MS);

		expect(urlQuery()).toBe("日本");
	});

	test("navigates no more once unmounted", async () => {
		const { input, urlQuery } = await renderSearch();

		fill(input, "eta");
		fireEvent.click(
			screen.getByRole("button", {
				name: "unmount",
			}),
		);
		await sleep(SETTLE_MS);

		expect(urlQuery()).toBe("");
	});

	test("accepts no more than the query param holds", async () => {
		const { input } = await renderSearch();

		expect(input.maxLength).toBe(dataTableQuerySchema.maxLength ?? -1);
		expect(
			dataTableQuerySchema.safeParse("x".repeat(input.maxLength)).success,
		).toBe(true);
		expect(
			dataTableQuerySchema.safeParse("x".repeat(input.maxLength + 1)).success,
		).toBe(false);
	});

	test("clears the query at once", async () => {
		const { input, urlQuery } = await renderSearch();

		await type(input, "theta");
		await waitFor(() => expect(urlQuery()).toBe("theta"));
		fireEvent.click(
			screen.getByRole("button", {
				name: m.data_table_search_clear_label(),
			}),
		);

		expect(input.value).toBe("");
		await waitFor(() => expect(urlQuery()).toBe(""));
	});
});
