import type { BotId } from "@orcai/core";
import type { BotListItem } from "@orcai/schema";
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
	DialogSelectTrigger,
} from "@/components/ui/composed/dialog-select";
import { LoadError } from "@/components/ui/composed/load-error";
import { SearchField } from "@/components/ui/composed/search-field";
import { Pager } from "@/components/ui/pager";
import { usePickerList } from "@/hooks/use-picker-list";
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
	const bots = usePickerList({
		pageSize: BOT_PAGE_SIZE,
		open: dialogOpen,
		queryOptions: (input) =>
			orpc.bot.list.queryOptions({
				input: {
					...input,
					filters: {
						usable: true,
					},
				},
			}),
	});

	const showFavourites = !bots.query;
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

	const favourites = showFavourites ? (favouritesQuery.data?.data ?? []) : [];
	const loading = bots.loading || (showFavourites && favouritesQuery.isLoading);
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
				<SearchField
					value={bots.search}
					onValueChange={bots.setSearch}
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
								{bots.rows.map((bot) => (
									<BotItem key={bot.id} bot={bot} />
								))}
							</DialogSelectGroup>
						</>
					) : (
						bots.rows.map((bot) => <BotItem key={bot.id} bot={bot} />)
					)}
					{bots.list.isError ? (
						<LoadError query={bots.list} />
					) : (
						bots.rows.length === 0 && (
							<DialogSelectEmpty>
								{m.chat_bot_selector_empty_state()}
							</DialogSelectEmpty>
						)
					)}
				</DialogSelectList>
				<Pager variant="compact" {...bots.pager} pending={loading} />
			</DialogSelectContent>
		</DialogSelect>
	);
};

export { BotSelectorButton };
