import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CogIcon } from "lucide-react";
import { Suspense } from "react";
import type { Chat } from "@/db/schema/chat";
import { botQueryOptions } from "@/lib/query-options/bot";
import { chatQueryOptions } from "@/lib/query-options/chat";
import { BotBlocks } from "../bot/bot-blocks";
import { BotConfiguration } from "../bot/bot-configuration";
import { BotMetadata } from "../bot/bot-metadata";
import { Button, buttonVariants } from "../ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "../ui/sheet";

const ChatSettings = ({ chatId }: { chatId: Chat["id"] }) => {
	const { data: chat } = useQuery(
		chatQueryOptions.find({ input: { id: chatId } }),
	);

	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button variant="ghost" size="icon">
					<CogIcon />
				</Button>
			</SheetTrigger>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>Edit profile</SheetTitle>
					<SheetDescription>
						Make changes to your profile here. Click save when you&apos;re done.
					</SheetDescription>
				</SheetHeader>
				<div className="grid flex-1 auto-rows-min gap-6 px-4">
					{chat?.data.botId && (
						<Suspense fallback={<div>Loading...</div>}>
							<BotDialog botId={chat.data.botId} />
						</Suspense>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
};

const BotDialog = ({ botId }: { botId: string }) => {
	const { data: bot } = useSuspenseQuery(
		botQueryOptions.find({ input: { id: botId } }),
	);

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="outline">{bot.data.name}</Button>
			</DialogTrigger>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>{bot.data.name}</DialogTitle>
					<DialogDescription>{bot.data.description}</DialogDescription>
				</DialogHeader>
				<ScrollArea className="max-h-[calc(100dvh-200px)]">
					<div className="flex flex-col gap-4">
						<BotConfiguration bot={bot.data} />
						<BotBlocks blocks={bot.data.blocks} />
						<BotMetadata bot={bot.data} />
					</div>
				</ScrollArea>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Close</Button>
					</DialogClose>
					<Link
						to="/app/bots/$botId"
						params={{ botId: bot.data.id }}
						className={buttonVariants({
							variant: "default",
						})}
					>
						Got to Bot
					</Link>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export { BotDialog, ChatSettings };
