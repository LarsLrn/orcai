import { format } from "date-fns";
import { CalendarIcon, EditIcon, GitForkIcon, UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { Bot } from "@/lib/orpc/schemas/bot";

const BotPreview = ({
	children,
	bot,
}: {
	children?: React.ReactElement;
	bot: Bot;
}) => {
	return (
		<Card key={bot.id} className="flex flex-col transition-all hover:shadow-md">
			<CardHeader className="flex-1">
				<div className="flex items-start justify-between">
					<div className="space-y-1">
						<CardTitle className="line-clamp-1 text-lg">{bot.name}</CardTitle>
						<div className="flex items-center gap-2">
							<Badge variant="secondary" className="text-xs">
								<UserIcon className="mr-1 h-3 w-3" />v{bot.version}
							</Badge>
							{bot.forkedFromId && (
								<Badge variant="outline" className="text-xs">
									<GitForkIcon className="mr-1 h-3 w-3" />
									Forked
								</Badge>
							)}
						</div>
					</div>
				</div>
				<CardDescription className="line-clamp-2 text-sm">
					{bot.description}
				</CardDescription>
			</CardHeader>

			{/* <CardContent className="flex-1">
				<div className="space-y-3">
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<CalendarIcon className="h-3 w-3" />
						Created {format(bot.createdAt ?? "", "MMM dd, yyyy")}
					</div>
					{bot.updatedAt && bot.updatedAt !== bot.createdAt && (
						<div className="flex items-center gap-2 text-muted-foreground text-xs">
							<EditIcon className="h-3 w-3" />
							Updated {format(bot.updatedAt, "MMM dd, yyyy")}
						</div>
					)}
				</div>
			</CardContent> */}

			{children}
		</Card>
	);
};

export { BotPreview };
