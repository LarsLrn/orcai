import { botIdSchema, listChatsInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MessagesSquareIcon, PlusIcon } from "lucide-react";
import type { z } from "zod/v4";
import {
	ChatHistoryLink,
	chatHistoryLinkQuery,
} from "@/components/chat/chat-history-link";
import { chatTableColumns } from "@/components/chat/table/chat-table-columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTableBulkDelete } from "@/components/ui/data-table/data-table-bulk-delete";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import { DataTableSelectFilter } from "@/components/ui/data-table/data-table-select-filter";
import {
	DataTableToolbar,
	DataTableToolbarActions,
} from "@/components/ui/data-table/data-table-toolbar";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { useDeleteChatsMutation } from "@/hooks/mutations/use-chat-mutation";
import {
	dataTableQuerySchema,
	paginationSearchShape,
} from "@/lib/browse/data-table-search-params";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const searchSchema = listChatsInputSchema
	.omit({
		filters: true,
		zedToken: true,
	})
	.extend({
		...paginationSearchShape,
		botId: botIdSchema.optional(),
		query: dataTableQuerySchema.default(""),
	});

const chatsQuery = ({
	botId,
	pageIndex,
	pageSize,
	query,
	sort,
}: Pick<
	z.output<typeof searchSchema>,
	"botId" | "pageIndex" | "pageSize" | "query" | "sort"
>) =>
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
	});

/** The bot filter's choices. */
const filterBotsQuery = () =>
	orpc.bot.list.queryOptions({
		input: {
			pageIndex: 0,
			pageSize: 1000,
		},
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
			queryClient.query(chatsQuery(deps)),
			queryClient.query(filterBotsQuery()),
			// The history link fails only itself.
			Promise.allSettled([
				queryClient.query(chatHistoryLinkQuery()),
			]),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const deleteChats = useDeleteChatsMutation();
	const navigate = useNavigate();
	const search = Route.useSearch();
	const { botId, pageIndex, pageSize, query, sort } = search;
	const { data: chats } = useSuspenseQuery(chatsQuery(search));
	const { data: bots } = useSuspenseQuery(filterBotsQuery());

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.chat_list_page_title()}</PageTitle>
				<PageAction>
					<ChatHistoryLink />
					<Link to="/app/chat/start" className={buttonVariants()}>
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
							<DataTableBulkDelete
								action={deleteChats}
								label={m.chat_table_bulk_delete_action()}
							/>
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
										to: "/app/chat/start",
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
