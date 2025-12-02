import { useQuery } from "@tanstack/react-query";
import { BotIcon, SearchIcon } from "lucide-react";
import { useDebounceValue } from "usehooks-ts";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/orpc/orpc";
import type { Bot } from "@/lib/orpc/schemas/bot";

interface BotSelectProps {
	onBotSelect: (bot: Bot | null) => void;
	selectedBot?: Bot | null;
}

const BotSelect = ({ onBotSelect, selectedBot }: BotSelectProps) => {
	const [searchQuery, setSearchQuery] = useDebounceValue("", 300);

	const {
		data: bots,
		status,
		error,
	} = useQuery(
		orpc.bot.list.queryOptions({
			input: {
				pageSize: 50,
				pageIndex: 0,
				search: searchQuery,
			},
		}),
	);

	const handleBotSelect = (bot: Bot) => {
		// Toggle selection: if clicking the same bot, deselect it
		if (selectedBot?.id === bot.id) {
			onBotSelect(null); // Clear selection
		} else {
			onBotSelect(bot);
		}
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			{/* Search Input */}
			<div className="relative">
				<SearchIcon className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground" />
				<Input
					placeholder="Search bot templates..."
					onChange={(e) => setSearchQuery(e.target.value)}
					className="pl-10"
				/>
			</div>

			{/* Results */}
			<div className="flex-1 space-y-3 overflow-y-auto">
				{status === "error" && (
					<div className="py-8 text-center text-destructive">
						<p>Failed to load bots</p>
						{error && (
							<p className="mt-2 text-muted-foreground text-sm">
								{error instanceof Error
									? error.message
									: "Unknown error occurred"}
							</p>
						)}
					</div>
				)}

				{status === "pending" && (
					<div className="space-y-3">
						{[...Array(3)].map((_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: <Fine for placeholder>
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
					<div className="flex flex-col gap-2">
						{bots.data.length === 0 ? (
							<div className="py-8 text-center text-muted-foreground">
								{searchQuery
									? `No bots found matching "${searchQuery}"`
									: "No bots available"}
							</div>
						) : (
							bots.data.map((bot: Bot) => (
								<Card
									key={bot.id}
									className={`cursor-pointer border-2 transition-all duration-200 hover:shadow-md ${
										selectedBot?.id === bot.id
											? "border-primary bg-primary/5 shadow-sm"
											: "border-transparent hover:bg-muted/50"
									}`}
									onClick={() => handleBotSelect(bot)}
								>
									<CardHeader className="pb-3">
										<div className="flex items-start justify-between">
											<div className="min-w-0 flex-1">
												<CardTitle className="flex items-center gap-2 truncate text-base">
													<BotIcon className="h-4 w-4 shrink-0" />
													<span className="truncate">{bot.name}</span>
												</CardTitle>
												<CardDescription className="mt-1 line-clamp-2 text-sm">
													{bot.description}
												</CardDescription>
											</div>
											<Badge
												variant="secondary"
												className="ml-2 shrink-0 text-xs"
											>
												v{bot.version}
											</Badge>
										</div>
									</CardHeader>
								</Card>
							))
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export { BotSelect };
