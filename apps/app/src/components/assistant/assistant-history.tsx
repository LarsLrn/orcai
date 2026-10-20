import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MoreHorizontalIcon } from "lucide-react";
import { useId, useState } from "react";
import { ChatActionsDropdown } from "@/components/chat/chat-actions-dropdown";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc/orpc";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const HISTORY_PAGE_SIZE = 20;

/** The caller's assistant conversations in the active organisation, most recently active first. */
const AssistantHistory = ({ className }: { className?: string }) => {
	const headingId = useId();
	const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZE);
	const { data, status, isFetching } = useQuery(
		orpc.assistant.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize,
			},
			placeholderData: (previous) => previous,
		}),
	);
	const conversations = data?.data ?? [];
	const hasMore = conversations.length < (data?.rowCount ?? 0);

	return (
		<section
			aria-labelledby={headingId}
			className={cn("flex flex-col gap-3", className)}
		>
			<h2 id={headingId} className="font-heading font-semibold text-base">
				{m.assistant_history_title()}
			</h2>
			{status === "pending" ? (
				<Spinner className="mx-auto my-4" />
			) : conversations.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{m.assistant_history_empty()}
				</p>
			) : (
				<ul className="flex flex-col divide-y rounded-xl border bg-card">
					{conversations.map((conversation) => (
						<li
							key={conversation.id}
							className="relative flex items-center gap-3 px-4 py-2.5 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50"
						>
							<div className="flex min-w-0 flex-1 flex-col">
								<Link
									to="/app/assistant/$chatId"
									params={{
										chatId: conversation.id,
									}}
									className="truncate font-medium text-sm after:absolute after:inset-0"
								>
									{conversation.title ?? m.chat_title_placeholder()}
								</Link>
								{conversation.updatedAt && (
									<span className="text-muted-foreground text-xs">
										{m.chat_list_card_last_updated({
											timestamp: formatDisplayTimestamp(conversation.updatedAt),
										})}
									</span>
								)}
							</div>
							<ChatActionsDropdown
								chatId={conversation.id}
								title={conversation.title}
								deleteRedirectTo="/app/assistant"
							>
								<Button
									variant="ghost"
									size="icon-sm"
									className="relative z-10 shrink-0 data-[state=open]:bg-muted"
								>
									<MoreHorizontalIcon />
									<span className="sr-only">{m.common_row_menu_trigger()}</span>
								</Button>
							</ChatActionsDropdown>
						</li>
					))}
				</ul>
			)}
			{hasMore && (
				<Button
					variant="ghost"
					size="sm"
					className="self-center"
					disabled={isFetching}
					onClick={() => setPageSize((size) => size + HISTORY_PAGE_SIZE)}
				>
					{m.assistant_history_show_more_action()}
				</Button>
			)}
		</section>
	);
};

export { AssistantHistory };
