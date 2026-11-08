import { afterEach, describe, expect, mock, test } from "bun:test";
import type { BlockId, UserId } from "@orcai/core";
import { type BlockListItem, listBlocksInputSchema } from "@orcai/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { scriptedOrpc } from "@/lib/testing/scripted-orpc";
import { m } from "@/paraglide/messages";

/** The library behind the scripted `block.list`, newest first. */
let library: BlockListItem[] = [];

const owner = {
	id: crypto.randomUUID() as UserId,
	name: "Ada",
	image: null,
};

const behaviours = (count: number) =>
	Array.from(
		{
			length: count,
		},
		(_, index): BlockListItem => ({
			id: crypto.randomUUID() as BlockId,
			type: "behaviour",
			name: `Behaviour ${String(index)}`,
			description: null,
			status: "ready",
			createdAt: null,
			capabilities: {},
			owner,
			homeOrganization: null,
			assets: null,
		}),
	);

mock.module("@/lib/orpc/orpc", () =>
	scriptedOrpc({
		block: {
			list: (input) => {
				const { pageIndex, pageSize, filters } =
					listBlocksInputSchema.parse(input);
				const search = filters?.search?.toLowerCase();
				const rows = library.filter(
					(block) => !search || block.name.toLowerCase().includes(search),
				);
				return {
					data: rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
					rowCount: rows.length,
				};
			},
		},
	}),
);

const { BlockSelectorDialog } = await import("./block-selector-dialog");

const renderSelector = () =>
	render(
		<QueryClientProvider client={new QueryClient()}>
			<BlockSelectorDialog
				open
				onOpenChange={() => undefined}
				type="behaviour"
				onSelect={() => undefined}
			/>
		</QueryClientProvider>,
	);

afterEach(cleanup);

describe("BlockSelectorDialog", () => {
	test("search finds a behaviour beyond the largest page the server returns", async () => {
		// One more than `block.list` returns in one page, so only a server search reaches the oldest.
		library = behaviours(1001);
		renderSelector();
		await screen.findByText("Behaviour 0");

		fireEvent.change(
			screen.getByPlaceholderText(
				m.blocks_selector_dialog_behaviour_search_placeholder(),
			),
			{
				target: {
					value: "Behaviour 1000",
				},
			},
		);

		expect(await screen.findByText("Behaviour 1000")).toBeTruthy();
	});

	test("paging reaches a behaviour on a later server page", async () => {
		library = behaviours(13);
		renderSelector();
		await screen.findByText("Behaviour 0");
		expect(screen.queryByText("Behaviour 12")).toBeNull();

		fireEvent.click(
			screen.getByLabelText(m.common_pagination_next_page_label()),
		);

		expect(await screen.findByText("Behaviour 12")).toBeTruthy();
		await waitFor(() => expect(screen.queryByText("Behaviour 0")).toBeNull());
	});
});
