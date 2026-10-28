import { botIdSchema, listChatsInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MessagesSquareIcon, PlusIcon } from "lucide-react";
import { ChatHistoryLink } from "@/components/chat/chat-history-link";
import { ChatTableActions } from "@/components/chat/table/chat-table-actions";
import { chatTableColumns } from "@/components/chat/table/chat-table-columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import { dataTableQuerySchema } from "@/components/ui/data-table/data-table-search-params";
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
import { m } from "@/paraglide/messages";

const searchSchema = listChatsInputSchema
	.omit({
		filters: true,
		zedToken: true,
	})
	.extend({
		botId: botIdSchema.optional(),
		query: dataTableQuerySchema.default(""),
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
			queryClient.query(
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
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.bot.list.queryOptions({
					input: {
						pageIndex: 0,
						pageSize: 1000,
					},
					staleTime: "static",
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
				<PageTitle>{m.chat_list_page_title()}</PageTitle>
				<PageAction>
					<ChatHistoryLink />
					<Link to="/app/chat/setup" className={buttonVariants()}>
						{m.chat_start_action()}
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
						<DataTableSearch placeholder={m.chat_list_search_placeholder()} />
						<DataTableSelectFilter
							label={m.chat_list_bot_filter_label()}
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
					<DataTableBody
						empty={{
							Icon: MessagesSquareIcon,
							title: m.chat_list_empty_state_title(),
							description: m.chat_list_page_empty_description(),
							actions: [
								{
									key: "start",
									label: m.chat_start_action(),
									icon: PlusIcon,
									variant: "default",
									linkProps: {
										to: "/app/chat/setup",
									},
								},
							],
						}}
						filters={{
							query,
							botId,
						}}
					/>
					<DataTablePagination />
				</DataTable>
			</PageContent>
		</Page>
	);
}
