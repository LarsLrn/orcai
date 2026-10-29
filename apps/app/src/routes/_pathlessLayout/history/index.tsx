import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	stripSearchParams,
} from "@tanstack/react-router";
import { ArrowLeftIcon, MessagesSquareIcon } from "lucide-react";
import { z } from "zod/v4";
import { DataExportCard } from "@/components/account/data-export-card";
import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { CardPager, useClampedPageIndex } from "@/components/ui/card-pager";
import { paginationSearchShape } from "@/components/ui/data-table/data-table-search-params";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/pager";
import { orpc } from "@/lib/orpc/orpc";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_pathlessLayout/history/")({
	validateSearch: z.object(paginationSearchShape),
	search: {
		middlewares: [
			stripSearchParams({
				pageIndex: 0,
				pageSize: DEFAULT_PAGE_SIZE,
			}),
		],
	},
	loaderDeps: ({ search: { pageIndex, pageSize } }) => ({
		pageIndex,
		pageSize,
	}),
	loader: ({ context: { queryClient }, deps }) =>
		queryClient.query(
			orpc.chat.history.queryOptions({
				input: deps,
				staleTime: 0,
			}),
		),
	component: RouteComponent,
});

function RouteComponent() {
	const { pageIndex, pageSize } = Route.useSearch();
	const { data: history } = useSuspenseQuery(
		orpc.chat.history.queryOptions({
			input: {
				pageIndex,
				pageSize,
			},
		}),
	);
	const rows = history.data;
	useClampedPageIndex({
		rowCount: history.rowCount,
		pageIndex,
		pageSize,
	});

	return (
		<div className="w-full max-w-3xl space-y-6">
			<Link
				to="/app"
				className={buttonVariants({
					variant: "link",
				})}
			>
				<ArrowLeftIcon />
				{m.chat_history_back_link()}
			</Link>
			<div className="space-y-2 text-center">
				<h1 className="font-semibold text-2xl tracking-tight">
					{m.chat_history_page_title()}
				</h1>
				<p className="text-lg text-muted-foreground">
					{m.chat_history_page_description()}
				</p>
			</div>

			{rows.length > 0 ? (
				<ul className="flex flex-col gap-3">
					{rows.map((chat) => (
						<li key={chat.id}>
							<Card
								size="sm"
								className="relative transition-colors hover:bg-muted/40 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/75"
							>
								<CardHeader>
									<CardTitle>
										<Link
											to="/history/$chatId"
											params={{
												chatId: chat.id,
											}}
											className="outline-none after:absolute after:inset-0"
										>
											{chat.title ?? m.chat_title_placeholder()}
										</Link>
									</CardTitle>
									<CardDescription>
										{m.chat_history_row_description({
											organisation: chat.organizationName,
											date: chat.updatedAt
												? formatDisplayDate(chat.updatedAt)
												: "",
										})}
									</CardDescription>
								</CardHeader>
							</Card>
						</li>
					))}
				</ul>
			) : (
				<Card className="py-12 text-center">
					<CardContent>
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
							<MessagesSquareIcon className="h-8 w-8 text-muted-foreground" />
						</div>
						<p className="text-lg text-muted-foreground">
							{m.chat_history_empty_title()}
						</p>
					</CardContent>
				</Card>
			)}

			<CardPager
				rowCount={history.rowCount}
				pageIndex={pageIndex}
				pageSize={pageSize}
			/>

			<DataExportCard />
		</div>
	);
}
