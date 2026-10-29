import type { BotId } from "@orcai/core";
import type { BotWithCapabilities } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { BotIcon, MessageSquareIcon } from "lucide-react";
import { useState } from "react";
import {
	BotFavouriteStar,
	FAVOURITE_CHAT_BOTS_INPUT,
} from "@/components/bot/bot-favourites";
import {
	DialogSelect,
	DialogSelectContent,
	DialogSelectEmpty,
	DialogSelectGroup,
	DialogSelectItem,
	DialogSelectList,
	DialogSelectPagination,
	DialogSelectSearch,
	DialogSelectTrigger,
} from "@/components/ui/composed/dialog-select";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const BOT_PAGE_SIZE = 20;
const NO_BOT_VALUE = "__no_bot__";

const BotItem = ({ bot }: { bot: BotWithCapabilities }) => (
	<DialogSelectItem
		value={bot.id}
		title={bot.name}
		description={bot.description || undefined}
		icon={<BotIcon className="size-4" />}
		trailing={bot.isFavourite ? <BotFavouriteStar /> : undefined}
	/>
);

const BotSelectorButton = ({
	selectedBotId,
	onSelectBot,
	variant = "full",
	className,
}: {
	selectedBotId?: BotId;
	onSelectBot: (botId?: BotId) => void;
	variant?: "compact" | "full";
	className?: string;
}) => {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(0);

	const {
		data: botsResult,
		isLoading,
		isFetching,
	} = useQuery(
		orpc.bot.list.queryOptions({
			input: {
				pageIndex: page,
				pageSize: BOT_PAGE_SIZE,
				search: search || undefined,
				filters: {
					usable: true,
				},
			},
			enabled: dialogOpen,
		}),
	);

	const showFavourites = !search;
	const favouritesQuery = useQuery(
		orpc.bot.list.queryOptions({
			input: FAVOURITE_CHAT_BOTS_INPUT,
			enabled: dialogOpen && showFavourites,
		}),
	);

	const { data: selectedBotResult } = useQuery(
		orpc.bot.find.queryOptions({
			input: {
				id: selectedBotId ?? "",
			},
			enabled: !!selectedBotId,
		}),
	);

	const bots = botsResult?.data ?? [];
	const favourites = showFavourites ? (favouritesQuery.data?.data ?? []) : [];
	const loading =
		isLoading ||
		isFetching ||
		(showFavourites &&
			(favouritesQuery.isLoading || favouritesQuery.isFetching));
	const pageCount = Math.ceil((botsResult?.rowCount ?? 0) / BOT_PAGE_SIZE);
	const triggerLabel =
		selectedBotResult?.data.name ?? m.chat_bot_selector_no_bot_title();

	return (
		<DialogSelect
			value={selectedBotId ?? NO_BOT_VALUE}
			onValueChange={(value) =>
				onSelectBot(
					value === NO_BOT_VALUE ? undefined : ((value as BotId) ?? undefined),
				)
			}
			open={dialogOpen}
			onOpenChange={setDialogOpen}
		>
			<DialogSelectTrigger
				className={cn(
					variant === "compact"
						? "max-w-80 border-transparent bg-transparent px-2 hover:bg-muted"
						: "w-full justify-between",
					className,
				)}
				placeholder={m.chat_bot_selector_trigger_placeholder()}
				size={variant === "compact" ? "sm" : "default"}
			>
				<BotIcon className="size-3.5" />
				<span className="truncate">{triggerLabel}</span>
			</DialogSelectTrigger>
			<DialogSelectContent title={m.chat_bot_selector_dialog_title()}>
				<DialogSelectSearch
					value={search}
					onValueChange={(value) => {
						setSearch(value);
						setPage(0);
					}}
					placeholder={m.chat_bot_selector_search_placeholder()}
				/>
				<DialogSelectList loading={loading}>
					<DialogSelectItem
						value={NO_BOT_VALUE}
						title={m.chat_bot_selector_no_bot_title()}
						description={m.chat_bot_selector_no_bot_description()}
						icon={<MessageSquareIcon className="size-4" />}
					/>
					{favourites.length > 0 ? (
						<>
							<DialogSelectGroup label={m.bots_favourites_group_label()}>
								{favourites.map((bot) => (
									<BotItem key={bot.id} bot={bot} />
								))}
							</DialogSelectGroup>
							<DialogSelectGroup label={m.bots_all_group_label()}>
								{bots.map((bot) => (
									<BotItem key={bot.id} bot={bot} />
								))}
							</DialogSelectGroup>
						</>
					) : (
						bots.map((bot) => <BotItem key={bot.id} bot={bot} />)
					)}
					{!loading && bots.length === 0 && (
						<DialogSelectEmpty>
							{m.chat_bot_selector_empty_state()}
						</DialogSelectEmpty>
					)}
				</DialogSelectList>
				<DialogSelectPagination
					page={page}
					pageCount={pageCount}
					onPageChange={setPage}
				/>
			</DialogSelectContent>
		</DialogSelect>
	);
};

export { BotSelectorButton };
