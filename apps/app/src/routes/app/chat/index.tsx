import { botIdSchema, listChatsInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod/v4";
import { ChatTableActions } from "@/components/chat/table/chat-table-actions";
import { chatTableColumns } from "@/components/chat/table/chat-table-columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import { DataTableSelectFilter } from "@/components/ui/data-table/data-table-select-filter";
import {
	DataTableToolbar,
	DataTableToolbarActions,
} from "@/components/ui/data-table/data-table-toolbar";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";

const searchSchema = listChatsInputSchema
	.omit({
		filters: true,
		zedToken: true,
	})
	.extend({
		botId: botIdSchema.optional(),
		query: z.string().trim().max(100).default(""),
	});

export const Route = createFileRoute("/app/chat/")({
	validateSearch: searchSchema,
	loaderDeps: ({ search: { botId, pageIndex, pageSize, query, sort } }) => ({
		botId,
		pageIndex,
		pageSize,
		query,
		sort,
	}),
	loader: async ({ context: { queryClient }, deps }) => {
		await Promise.all([
			queryClient.ensureQueryData(
				orpc.chat.list.queryOptions({
					input: {
						filters: {
							botId: deps.botId,
							search: deps.query || undefined,
						},
						pageIndex: deps.pageIndex,
						pageSize: deps.pageSize,
						sort: deps.sort,
					},
				}),
			),
			queryClient.ensureQueryData(
				orpc.bot.list.queryOptions({
					input: {
						pageIndex: 0,
						pageSize: 1000,
					},
				}),
			),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const { botId, pageIndex, pageSize, query, sort } = Route.useSearch();
	const { data: chats } = useSuspenseQuery(
		orpc.chat.list.queryOptions({
			input: {
				filters: {
					botId,
					search: query || undefined,
				},
				pageIndex,
				pageSize,
				sort,
			},
		}),
	);
	const { data: bots } = useSuspenseQuery(
		orpc.bot.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 1000,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Chats</PageTitle>
				<PageAction>
					<Link to="/app/chat/setup" className={buttonVariants()}>
						Start a chat
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent>
				<DataTable
					data={chats.data}
					columns={chatTableColumns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
						sorting: sort,
					}}
					options={{
						rowCount: chats.rowCount,
						uidAccessor: "id",
					}}
				>
					<DataTableToolbar>
						<DataTableSearch
							value={query}
							placeholder="Search chats..."
							onChange={(value) =>
								void navigate({
									to: ".",
									search: (prev) => ({
										...prev,
										pageIndex: 0,
										query: value,
									}),
									replace: true,
								})
							}
						/>
						<DataTableSelectFilter
							label="Bot"
							value={botId}
							options={bots.data.map((bot) => ({
								label: bot.name,
								value: bot.id,
							}))}
							onChange={(value) =>
								void navigate({
									to: ".",
									search: (prev) => ({
										...prev,
										botId: value,
										pageIndex: 0,
									}),
								})
							}
						/>
						<DataTableToolbarActions>
							<DataTableViewOptions />
							<ChatTableActions />
						</DataTableToolbarActions>
					</DataTableToolbar>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
			</PageContent>
		</Page>
	);
}
