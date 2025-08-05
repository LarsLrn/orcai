import { format } from "date-fns";
import { CalendarIcon, Clock, GitForkIcon, UserIcon } from "lucide-react";
import type { Bot } from "@/lib/orpc/schemas/bot";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const BotMetadata = ({ bot }: { bot: Bot }) => {
	const formatDate = (date: Date | string) => {
		const dateObj = typeof date === "string" ? new Date(date) : date;
		return format(dateObj, "PPP 'at' p");
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Bot Details</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-3 text-sm">
					<div className="flex items-center gap-2">
						<CalendarIcon className="size-4 text-muted-foreground" />
						<span className="text-muted-foreground">Created:</span>
						<span className="font-medium">
							{formatDate(bot.createdAt || new Date())}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<Clock className="size-4 text-muted-foreground" />
						<span className="text-muted-foreground">Updated:</span>
						<span className="font-medium">
							{formatDate(bot.updatedAt || new Date())}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<UserIcon className="size-4 text-muted-foreground" />
						<span className="text-muted-foreground">Owner:</span>
						<span className="font-medium">{bot.userId.slice(0, 8)}...</span>
					</div>
					{bot.forkedFromId && (
						<div className="flex items-center gap-2">
							<GitForkIcon className="size-4 text-muted-foreground" />
							<span className="text-muted-foreground">Forked from:</span>
							<span className="font-medium">
								{bot.forkedFromId.slice(0, 8)}...
							</span>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
};

export { BotMetadata };
