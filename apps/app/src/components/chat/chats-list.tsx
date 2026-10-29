import { useQuery } from "@tanstack/react-query";
import { MessagesSquareIcon, PlusIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { OverflowMenuTrigger } from "@/components/ui/shell/actions";
import {
	Tile,
	TileBody,
	TileDescription,
	TileFooter,
	TileMenu,
	TileTitle,
} from "@/components/ui/shell/tile";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc/orpc";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { BranchMark } from "./branch-links";
import { ChatActionsDropdown } from "./chat-actions-dropdown";
import { PinMark } from "./pin-mark";

const ChatsList = ({
	limit,
	...props
}: {
	limit?: number;
} & ComponentProps<"div">) => {
	const pageSize = limit ?? 100;
	const { data, status } = useQuery(
		orpc.chat.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize,
			},
		}),
	);

	if (status === "pending") {
		return <Spinner className="mx-auto my-4" />;
	}

	if (!data?.data || data.data.length === 0) {
		return (
			<Placeholder
				Icon={MessagesSquareIcon}
				title={m.chat_list_empty_state_title()}
				description={m.chat_list_empty_state_description()}
				className={props.className}
				actions={[
					{
						key: "start",
						label: m.chat_start_action(),
						icon: PlusIcon,
						linkProps: {
							to: "/app/chat/setup",
						},
					},
				]}
			/>
		);
	}

	return (
		<div
			className={cn(
				"grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
				props.className,
			)}
			{...props}
		>
			{data.data.map((chat) => (
				<Tile key={chat.id}>
					<TileBody>
						<TileTitle
							action={{
								linkProps: {
									to: "/app/chat/$chatId",
									params: {
										chatId: chat.id,
									},
								},
							}}
						>
							<span className="inline-flex max-w-full items-center gap-1.5 align-bottom">
								{chat.pinnedAt && <PinMark />}
								{chat.parentChatId && <BranchMark />}
								<span className="line-clamp-1 min-w-0">
									{chat.title ?? m.chat_title_placeholder()}
								</span>
							</span>
						</TileTitle>
						{chat.updatedAt && (
							<TileDescription>
								{m.chat_list_card_last_updated({
									timestamp: formatDisplayTimestamp(chat.updatedAt),
								})}
							</TileDescription>
						)}
						<TileFooter>
							<MessagesSquareIcon aria-hidden="true" className="size-4" />
							{m.chat_list_card_continue_action()}
						</TileFooter>
					</TileBody>
					<TileMenu actions={[]}>
						<ChatActionsDropdown
							chatId={chat.id}
							title={chat.title}
							pinned={chat.pinnedAt !== null}
						>
							<OverflowMenuTrigger variant="ghost" />
						</ChatActionsDropdown>
					</TileMenu>
				</Tile>
			))}
		</div>
	);
};

export { ChatsList };
