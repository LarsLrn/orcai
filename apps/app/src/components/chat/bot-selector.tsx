import { useQuery } from "@tanstack/react-query";
import { BotIcon, MessageSquareIcon } from "lucide-react";
import { useState } from "react";
import {
	DialogSelect,
	DialogSelectContent,
	DialogSelectEmpty,
	DialogSelectItem,
	DialogSelectList,
	DialogSelectPagination,
	DialogSelectSearch,
	DialogSelectTrigger,
} from "@/components/ui/composed/dialog-select";
import { orpc } from "@/lib/orpc/orpc";
import type { Bot } from "@/lib/orpc/schemas/bot";
import { cn } from "@/lib/utils";

const BOT_PAGE_SIZE = 20;
const NO_BOT_VALUE = "__no_bot__";

const BotSelectorButton = ({
	selectedBotId,
	onSelectBot,
	variant = "full",
	className,
}: {
	selectedBotId?: Bot["id"];
	onSelectBot: (botId?: Bot["id"]) => void;
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
	} = useQuery({
		...orpc.bot.list.queryOptions({
			input: {
				pageIndex: page,
				pageSize: BOT_PAGE_SIZE,
				search: search || undefined,
			},
		}),
		enabled: dialogOpen,
	});

	const { data: selectedBotResult } = useQuery({
		...orpc.bot.find.queryOptions({
			input: {
				id: selectedBotId ?? "",
			},
		}),
		enabled: !!selectedBotId,
	});

	const bots = botsResult?.data ?? [];
	const pageCount = Math.ceil((botsResult?.rowCount ?? 0) / BOT_PAGE_SIZE);
	const triggerLabel = selectedBotResult?.data.name ?? "No bot (free-form)";

	return (
		<DialogSelect
			value={selectedBotId ?? NO_BOT_VALUE}
			onValueChange={(value) =>
				onSelectBot(value === NO_BOT_VALUE ? undefined : (value ?? undefined))
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
				placeholder="Choose bot..."
				size={variant === "compact" ? "sm" : "default"}
			>
				<BotIcon className="size-3.5" />
				<span className="truncate">{triggerLabel}</span>
			</DialogSelectTrigger>
			<DialogSelectContent title="Choose a bot">
				<DialogSelectSearch
					value={search}
					onValueChange={(value) => {
						setSearch(value);
						setPage(0);
					}}
					placeholder="Search bots..."
				/>
				<DialogSelectList loading={isLoading || isFetching}>
					<DialogSelectItem
						value={NO_BOT_VALUE}
						title="No bot (free-form chat)"
						description="Start without a bot and configure behaviour in chat settings."
						icon={<MessageSquareIcon className="size-4" />}
					/>
					{bots.map((bot) => (
						<DialogSelectItem
							key={bot.id}
							value={bot.id}
							title={bot.name}
							description={bot.description || undefined}
							icon={<BotIcon className="size-4" />}
						/>
					))}
					{!isLoading && !isFetching && bots.length === 0 && (
						<DialogSelectEmpty>No bots found.</DialogSelectEmpty>
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
