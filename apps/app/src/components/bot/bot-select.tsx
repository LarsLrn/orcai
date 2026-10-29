import type { Bot, BotWithCapabilities } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { BotIcon, SearchIcon } from "lucide-react";
import { useDebounceValue } from "usehooks-ts";
import {
	BotFavouriteStar,
	FAVOURITE_CHAT_BOTS_INPUT,
} from "@/components/bot/bot-favourites";
import { Card, CardHeader } from "@/components/ui/card";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { describeError } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

interface BotSelectProps {
	onBotSelect: (bot: Bot | null) => void;
	selectedBot?: Bot | null;
}

const BotRadioGroup = ({
	id,
	label,
	heading = false,
	bots,
	selectedBot,
	onBotSelect,
}: {
	id: string;
	label: string;
	heading?: boolean;
	bots: BotWithCapabilities[];
	selectedBot?: Bot | null;
	onBotSelect: (bot: Bot | null) => void;
}) => (
	<div className="flex flex-col gap-2">
		{heading ? (
			<h3
				id={`bot-select-${id}`}
				className="font-medium text-muted-foreground text-xs"
			>
				{label}
			</h3>
		) : null}
		<RadioGroup
			aria-label={heading ? undefined : label}
			aria-labelledby={heading ? `bot-select-${id}` : undefined}
			value={selectedBot?.id ?? null}
			onValueChange={(botId) =>
				onBotSelect(bots.find((bot) => bot.id === botId) ?? null)
			}
			className="gap-2"
		>
			{bots.map((bot) => {
				const itemId = `bot-select-${id}-${bot.id}`;

				return (
					<FieldLabel
						key={bot.id}
						htmlFor={itemId}
						className="cursor-pointer transition-colors hover:bg-muted/50 has-data-checked:border-primary has-focus-visible:border-ring has-data-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/30"
					>
						<Field orientation="horizontal">
							<RadioGroupItem
								value={bot.id}
								id={itemId}
								aria-labelledby={`${itemId}-name`}
								aria-describedby={`${itemId}-description`}
							/>
							<FieldContent className="min-w-0">
								<FieldTitle className="w-full min-w-0 text-base">
									<BotIcon className="size-4 shrink-0" aria-hidden="true" />
									<span id={`${itemId}-name`} className="truncate">
										{bot.name}
									</span>
									{bot.isFavourite ? (
										<BotFavouriteStar className="shrink-0" />
									) : null}
								</FieldTitle>
								<FieldDescription
									id={`${itemId}-description`}
									className="line-clamp-2"
								>
									{bot.description}
								</FieldDescription>
							</FieldContent>
						</Field>
					</FieldLabel>
				);
			})}
		</RadioGroup>
	</div>
);

const BotSelect = ({ onBotSelect, selectedBot }: BotSelectProps) => {
	const [searchQuery, setSearchQuery] = useDebounceValue("", 300);
	const showFavourites = !searchQuery;

	const botsQuery = useQuery(
		orpc.bot.list.queryOptions({
			input: {
				pageSize: 50,
				pageIndex: 0,
				search: searchQuery,
				filters: {
					usable: true,
				},
			},
		}),
	);
	const favouritesQuery = useQuery(
		orpc.bot.list.queryOptions({
			input: FAVOURITE_CHAT_BOTS_INPUT,
			enabled: showFavourites,
		}),
	);
	const queries = showFavourites
		? [
				botsQuery,
				favouritesQuery,
			]
		: [
				botsQuery,
			];
	const error = queries.find((query) => query.status === "error")?.error;
	const status = error
		? "error"
		: queries.some((query) => query.status === "pending")
			? "pending"
			: "success";
	const bots = botsQuery.data?.data ?? [];
	const favourites = showFavourites ? (favouritesQuery.data?.data ?? []) : [];

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			{/* Search Input */}
			<div className="relative">
				<SearchIcon
					aria-hidden="true"
					className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground"
				/>
				<Input
					aria-label={m.bots_select_search_placeholder()}
					placeholder={m.bots_select_search_placeholder()}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="pl-10"
				/>
			</div>

			{/* Results */}
			<div className="flex-1 space-y-3 overflow-y-auto">
				{status === "error" && (
					<div className="py-8 text-center text-destructive">
						<p>{m.bots_select_load_error_title()}</p>
						{error && (
							<p className="mt-2 text-muted-foreground text-sm">
								{error instanceof Error
									? describeError(error)
									: m.bots_select_load_error_description()}
							</p>
						)}
					</div>
				)}

				{status === "pending" && (
					<div className="space-y-3">
						{[
							...Array(3),
						].map((_, i) => (
							<Card key={i}>
								<CardHeader className="pb-3">
									<div className="flex items-start justify-between">
										<div className="flex-1 space-y-2">
											<div className="flex items-center gap-2">
												<Skeleton className="h-4 w-4" />
												<Skeleton className="h-4 w-32" />
											</div>
											<Skeleton className="h-3 w-full" />
											<Skeleton className="h-3 w-3/4" />
										</div>
										<Skeleton className="h-5 w-8" />
									</div>
								</CardHeader>
							</Card>
						))}
					</div>
				)}

				{status === "success" && (
					<div className="flex flex-col gap-2 p-1">
						{bots.length === 0 ? (
							<div className="py-8 text-center text-muted-foreground">
								{searchQuery
									? m.bots_select_no_results({
											query: searchQuery,
										})
									: m.bots_select_empty_state_title()}
							</div>
						) : favourites.length > 0 ? (
							<>
								<BotRadioGroup
									id="favourites"
									label={m.bots_favourites_group_label()}
									heading
									bots={favourites}
									selectedBot={selectedBot}
									onBotSelect={onBotSelect}
								/>
								<BotRadioGroup
									id="all"
									label={m.bots_all_group_label()}
									heading
									bots={bots}
									selectedBot={selectedBot}
									onBotSelect={onBotSelect}
								/>
							</>
						) : (
							<BotRadioGroup
								id="all"
								label={m.bots_select_group_aria_label()}
								bots={bots}
								selectedBot={selectedBot}
								onBotSelect={onBotSelect}
							/>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export { BotSelect };
