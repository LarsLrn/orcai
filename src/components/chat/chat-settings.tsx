import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BotIcon } from "lucide-react";
import { Suspense } from "react";
import { BotBlocks } from "@/components/bot/bot-blocks";
import { BotConfiguration } from "@/components/bot/bot-configuration";
import { BotMetadata } from "@/components/bot/bot-metadata";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import type { Chat } from "@/lib/orpc/schemas/chat";
import { blockQueryOptions } from "@/lib/query-options/block";
import { botQueryOptions } from "@/lib/query-options/bot";
import { chatQueryOptions } from "@/lib/query-options/chat";
import { Skeleton } from "../ui/skeleton";

const ChatSettings = ({
	className,
	chatId,
}: {
	className?: string;
	chatId: Chat["id"];
}) => {
	const { data: chat } = useQuery(
		chatQueryOptions.find({ input: { id: chatId } }),
	);

	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button variant="ghost" size="icon" className={className}>
					<BotIcon />
				</Button>
			</SheetTrigger>
			<SheetContent className="h-dvh pb-4 sm:max-w-3xl">
				<SheetHeader>
					<SheetTitle>Chat Settings</SheetTitle>
					<SheetDescription>
						You are using a bot for this chat. Settings can only be adjusted
						when building your own bot or custom chat.
					</SheetDescription>
				</SheetHeader>
				<ScrollArea className="min-h-0">
					<div className="grid auto-rows-min gap-6 px-4">
						{chat?.data.botId && (
							<Suspense fallback={<Skeleton className="h-12 w-full" />}>
								<BotDetails botId={chat.data.botId} />
							</Suspense>
						)}
					</div>
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
};

const BotDetails = ({ botId }: { botId: string }) => {
	const { data: bot } = useSuspenseQuery(
		botQueryOptions.find({ input: { id: botId } }),
	);

	const { data: blocks } = useSuspenseQuery(
		blockQueryOptions.list({
			input: { filters: { botId } },
		}),
	);

	return (
		<div className="flex w-full flex-col gap-2">
			<BotConfiguration bot={bot.data} />
			<BotBlocks blocks={blocks.data} />
			<BotMetadata bot={bot.data} />
			<Link
				to="/app/bots/$botId"
				params={{ botId: bot.data.id }}
				className={buttonVariants({ variant: "outline" })}
			>
				Go to Bot
			</Link>
		</div>
	);
};

export { ChatSettings };
