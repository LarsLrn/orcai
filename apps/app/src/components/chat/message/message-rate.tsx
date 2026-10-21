import type { ChatId, ChatMessageId } from "@orcai/core";
import type { ChatMessageRating } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, StarIcon } from "lucide-react";
import { MessageAction as Action } from "@/components/ai-elements/message";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRateChatMessageMutation } from "@/hooks/mutations/use-chat-message-mutations";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const MessageRate = ({
	messageId,
	chatId,
	className,
}: {
	messageId: ChatMessageId;
	chatId: ChatId;
	className?: string;
}) => {
	const { data: ratings } = useQuery(
		orpc.chatMessage.listRatings.queryOptions({
			input: {
				chatId,
			},
		}),
	);
	const { mutate: rateMessage } = useRateChatMessageMutation();
	const score = ratings?.data.find(
		(entry) => entry.messageId === messageId,
	)?.rating;

	// Choosing the current rating again clears it.
	const handleRate = (rating: ChatMessageRating) => {
		rateMessage({
			id: messageId,
			chatId,
			rating: rating === score ? null : rating,
		});
	};

	const options: {
		label: string;
		value: ChatMessageRating;
	}[] = [
		{
			label: m.chat_message_rate_option_very_much(),
			value: "very_much",
		},
		{
			label: m.chat_message_rate_option_a_bit(),
			value: "a_bit",
		},
		{
			label: m.chat_message_rate_option_not_really(),
			value: "not_really",
		},
		{
			label: m.chat_message_rate_option_not_at_all(),
			value: "not_at_all",
		},
	];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Action
						label={m.chat_message_rate_action_label()}
						tooltip={m.chat_message_rate_tooltip()}
						className={cn(
							className,
							score &&
								"bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary",
						)}
					>
						<StarIcon
							fill={score ? "currentColor" : "none"}
							className="size-3"
						/>
					</Action>
				}
			/>
			<DropdownMenuContent align="start" className="w-48">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="text-xs">
						{m.chat_message_rate_prompt()}
					</DropdownMenuLabel>
					<DropdownMenuSeparator />

					{options.map((rating) => (
						<DropdownMenuItem
							key={rating.value}
							onClick={() => handleRate(rating.value)}
							className={cn(
								"cursor-pointer",
								score === rating.value && "bg-primary/10 text-primary",
							)}
						>
							<span className="flex items-center gap-2">
								{score === rating.value && <CheckIcon className="size-3" />}
								{rating.label}
							</span>
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { MessageRate };
