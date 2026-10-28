import { paginationInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	stripSearchParams,
} from "@tanstack/react-router";
import { ArrowLeftIcon, MessagesSquareIcon } from "lucide-react";
import { DataExportCard } from "@/components/account/data-export-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardPager, useClampedPageIndex } from "@/components/ui/card-pager";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/pager";
import {
	ResourceCard,
	ResourceCardBody,
	ResourceCardDescription,
	ResourceCardHeader,
	ResourceCardTitle,
} from "@/components/ui/shell/resource-card";
import { orpc } from "@/lib/orpc/orpc";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_pathlessLayout/history/")({
	validateSearch: paginationInputSchema,
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
				<div className="grid gap-4 md:grid-cols-2">
					{rows.map((chat) => (
						<ResourceCard key={chat.id}>
							<ResourceCardBody
								action={{
									linkProps: {
										to: "/history/$chatId",
										params: {
											chatId: chat.id,
										},
									},
								}}
							>
								<ResourceCardHeader>
									<ResourceCardTitle>
										{chat.title ?? m.chat_title_placeholder()}
									</ResourceCardTitle>
									<ResourceCardDescription>
										{m.chat_history_row_description({
											organisation: chat.organizationName,
											date: chat.updatedAt
												? formatDisplayDate(chat.updatedAt)
												: "",
										})}
									</ResourceCardDescription>
								</ResourceCardHeader>
							</ResourceCardBody>
						</ResourceCard>
					))}
				</div>
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
