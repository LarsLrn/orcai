import type { BotId } from "@orcai/core";
import type { BotListItem } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { BotIcon, MessageSquareIcon } from "lucide-react";
import { useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import {
	BotFavouriteStar,
	FAVOURITE_CHAT_BOTS_INPUT,
} from "@/components/bot/bot-favourites";
import { Button } from "@/components/ui/button";
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
import { describeError } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const BOT_PAGE_SIZE = 20;
const NO_BOT_VALUE = "__no_bot__";

const BotItem = ({ bot }: { bot: BotListItem }) => (
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
	disabled,
	className,
}: {
	selectedBotId?: BotId;
	onSelectBot: (botId?: BotId) => void;
	variant?: "compact" | "full";
	disabled?: boolean;
	className?: string;
}) => {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [debouncedSearch] = useDebounceValue(search, 300);
	const [page, setPage] = useState(0);
	const query = debouncedSearch.trim() || undefined;

	const botsQuery = useQuery(
		orpc.bot.list.queryOptions({
			input: {
				pageIndex: page,
				pageSize: BOT_PAGE_SIZE,
				search: query,
				filters: {
					usable: true,
				},
			},
			enabled: dialogOpen,
		}),
	);

	const showFavourites = !query;
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

	const bots = botsQuery.isError ? [] : (botsQuery.data?.data ?? []);
	const favourites = showFavourites ? (favouritesQuery.data?.data ?? []) : [];
	// Rows of the previous search are not choices while the next one is typed.
	const loading =
		search.trim() !== debouncedSearch.trim() ||
		botsQuery.isLoading ||
		(showFavourites && favouritesQuery.isLoading);
	// The pager keeps the search's last count while another of its pages loads.
	const [counted, setCounted] = useState({
		query,
		rowCount: 0,
	});
	const rowCount = botsQuery.data?.rowCount;
	if (
		rowCount !== undefined &&
		(counted.query !== query || counted.rowCount !== rowCount)
	) {
		setCounted({
			query,
			rowCount,
		});
	}
	const pageCount = Math.ceil(
		(counted.query === query ? counted.rowCount : 0) / BOT_PAGE_SIZE,
	);
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
			onOpenChange={(open) => {
				setDialogOpen(open);
				if (!open) {
					setSearch("");
					setPage(0);
				}
			}}
		>
			<DialogSelectTrigger
				className={cn(
					variant === "compact"
						? "hover:bg-muted max-w-80 border-transparent bg-transparent px-2"
						: "w-full justify-between",
					className,
				)}
				placeholder={m.chat_bot_selector_trigger_placeholder()}
				size={variant === "compact" ? "sm" : "default"}
				disabled={disabled}
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
					{botsQuery.isError ? (
						<DialogSelectEmpty role="alert">
							{describeError(botsQuery.error)}
							<Button
								variant="outline"
								size="sm"
								className="mt-3"
								loading={botsQuery.isRefetching}
								onClick={() => void botsQuery.refetch()}
							>
								{m.common_retry_button()}
							</Button>
						</DialogSelectEmpty>
					) : (
						bots.length === 0 && (
							<DialogSelectEmpty>
								{m.chat_bot_selector_empty_state()}
							</DialogSelectEmpty>
						)
					)}
				</DialogSelectList>
				<DialogSelectPagination
					page={page}
					pageCount={pageCount}
					onPageChange={setPage}
					disabled={loading}
				/>
			</DialogSelectContent>
		</DialogSelect>
	);
};

export { BotSelectorButton };
