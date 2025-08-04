import {
	BotMessageSquareIcon,
	CopyIcon,
	GitForkIcon,
	Trash2Icon,
} from "lucide-react";
import type { Bot } from "@/db/schema/bot";
import { NewChatButton } from "../chat/new-chat-button";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";

const BotQuickActions = ({ bot }: { bot: Bot }) => {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Quick Actions</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				<NewChatButton
					variant="outline"
					botId={bot.id}
					className="w-full justify-start gap-2"
				>
					<BotMessageSquareIcon className="size-4" />
					Start Chat
				</NewChatButton>
				<Button variant="outline" className="w-full justify-start gap-2">
					<CopyIcon className="size-4" />
					Duplicate
				</Button>
				<Button variant="outline" className="w-full justify-start gap-2">
					<GitForkIcon className="size-4" />
					Create Fork
				</Button>
				<Separator className="my-3" />
				<Button
					variant="outline"
					className="w-full justify-start gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
				>
					<Trash2Icon className="size-4" />
					Delete Bot
				</Button>
			</CardContent>
		</Card>
	);
};

export { BotQuickActions };
