import {
	BotMessageSquareIcon,
	CopyIcon,
	GitForkIcon,
	Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCreateChatMutation } from "@/hooks/mutations/use-chat-mutation";
import type { Bot } from "@/lib/orpc/schemas/bot";

const BotQuickActions = ({ bot }: { bot: Bot }) => {
	const { mutate: createChat } = useCreateChatMutation();

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Quick Actions</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				<Button
					variant="outline"
					onClick={() => createChat({ botId: bot.id })}
					className="w-full justify-start gap-2"
				>
					<BotMessageSquareIcon className="size-4" />
					Start Chat
				</Button>
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
