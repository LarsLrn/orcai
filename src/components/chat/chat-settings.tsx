import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { BotIcon } from "lucide-react";
import { Suspense } from "react";
import { BlockCard } from "@/components/blocks/block-card";
import { BotCard } from "@/components/bot/bot-card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/orpc/orpc";
import type { Chat } from "@/lib/orpc/schemas/chat";

const ChatSettings = ({
	className,
	chatId,
}: {
	className?: string;
	chatId: Chat["id"];
}) => {
	const { data: chat } = useQuery(
		orpc.chat.find.queryOptions({
			input: {
				id: chatId,
			},
		}),
	);

	return (
		<Sheet>
			<SheetTrigger
				render={
					<Button variant="ghost" size="icon" className={className}>
						<BotIcon />
					</Button>
				}
			/>
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
		orpc.bot.find.queryOptions({
			input: {
				id: botId,
			},
		}),
	);

	const { data: blocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				filters: {
					botId,
				},
			},
		}),
	);

	return (
		<div className="flex w-full flex-col gap-2">
			<BotCard bot={bot.data} />

			{blocks.data.map((block) => (
				<BlockCard key={block.id} block={block} />
			))}
		</div>
	);
};

export { ChatSettings };
