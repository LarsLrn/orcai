import { Code2Icon } from "lucide-react";
import { ContentRenderer } from "@/components/editor";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { Bot } from "@/lib/orpc/schemas/bot";

const BotConfiguration = ({ bot }: { bot: Bot }) => {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Code2Icon className="size-5" />
					Configuration
				</CardTitle>
				<CardDescription>
					Bot configuration and content settings
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div>
					<div className="font-medium text-sm">Description</div>
					<div>{bot.description}</div>
					<div className="mt-2 max-h-32 overflow-y-auto rounded-md border bg-muted/50 p-3 text-sm">
						<div className="prose prose-sm max-w-none">
							<ContentRenderer html={bot.contentHtml} />
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export { BotConfiguration };
