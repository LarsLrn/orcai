import type { ChatId, ChatMessageId } from "@orcai/core";
import { CheckIcon, StarIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
	// TODO: fetch initial score and set it here, leftover from removing Langfuse and needs proper implementation
	const [score, setScore] = useState<number | undefined | null>(undefined);

	const { mutate: rateMessage } = useRateChatMessageMutation({
		onMutate: ({ sentiment }) => {
			setScore(sentiment);
		},
		onError: () => {
			setScore(score);
		},
	});

	useEffect(() => {
		setScore(score);
	}, [
		score,
	]);

	const handleRate = (sentiment: number) => {
		rateMessage({
			id: messageId,
			chatId,
			sentiment,
		});
	};

	const ratings = [
		{
			label: m.chat_message_rate_option_very_much(),
			value: 10,
		},
		{
			label: m.chat_message_rate_option_a_bit(),
			value: 5,
		},
		{
			label: m.chat_message_rate_option_not_really(),
			value: -5,
		},
		{
			label: m.chat_message_rate_option_not_at_all(),
			value: -10,
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

					{ratings.map((rating) => (
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
