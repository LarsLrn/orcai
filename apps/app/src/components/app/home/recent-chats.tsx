import type { ChatListRow } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BotIcon, MessagesSquareIcon } from "lucide-react";
import { BranchMark } from "@/components/chat/branch-links";
import { PinMark } from "@/components/chat/pin-mark";
import { useDisplayTime } from "@/hooks/use-display-time";
import { formatRelativeTime } from "@/lib/locale/format-timestamp";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { HomeSection } from "./home-section";

/** Newest first, so a pinned older chat does not push a recent one out. */
export const recentChatsQuery = () =>
	orpc.chat.list.queryOptions({
		input: {
			pageIndex: 0,
			pageSize: 4,
			sort: [
				{
					id: "updatedAt",
					desc: true,
				},
			],
		},
	});

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const RecentChatRow = ({ chat }: { chat: ChatListRow }) => {
	const updatedAt = chat.updatedAt ?? chat.createdAt;
	const displayTime = useDisplayTime();
	// "12 minutes ago" within the week, the date after that.
	const updatedLabel = (at: Date) =>
		Date.now() - at.getTime() < WEEK_MS
			? formatRelativeTime(at)
			: displayTime.date(at);

	return (
		<Link
			to="/app/chat/$chatId"
			params={{
				chatId: chat.id,
			}}
			className="group/row hover:bg-muted focus-visible:ring-ring/75 flex items-center gap-3 rounded-xl px-3 py-2.5 outline-none focus-visible:ring-3"
		>
			<span className="bg-muted text-muted-foreground group-hover/row:bg-background flex size-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4">
				{chat.botId ? (
					<BotIcon aria-hidden="true" className="text-kind-bot" />
				) : (
					<MessagesSquareIcon aria-hidden="true" />
				)}
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex items-center gap-1.5 text-sm font-medium">
					{chat.pinnedAt && <PinMark />}
					{chat.parentChatId && <BranchMark />}
					<span className="truncate">
						{chat.title ?? m.chat_title_placeholder()}
					</span>
				</span>
				<span className="text-muted-foreground block truncate text-xs">
					{chat.botName ?? m.chat_bot_selector_no_bot_title()}
					{updatedAt && (
						<>
							{" · "}
							{/* The server's clock may differ by a minute. */}
							<time
								dateTime={updatedAt.toISOString()}
								suppressHydrationWarning={true}
							>
								{updatedLabel(updatedAt)}
							</time>
						</>
					)}
				</span>
			</span>
		</Link>
	);
};

/** The user's latest chats in this organisation, as compact rows. */
const RecentChats = () => {
	const { data } = useSuspenseQuery(recentChatsQuery());

	return (
		<HomeSection
			title={m.home_chats_section_title()}
			linkLabel={m.home_chats_all_action()}
			linkProps={{
				to: "/app/chat",
			}}
		>
			{data.data.length > 0 ? (
				<div className="grid grid-cols-1 sm:-mx-3 sm:grid-cols-2">
					{data.data.map((chat) => (
						<RecentChatRow key={chat.id} chat={chat} />
					))}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{m.home_chats_empty()}</p>
			)}
		</HomeSection>
	);
};

export { RecentChats };
