import type { ApiGetScoresResponseData } from "langfuse";
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
import type { Chat } from "@/lib/orpc/schemas/chat";
import type { ChatMessage } from "@/lib/orpc/schemas/chat-message";
import { cn } from "@/lib/utils";

const MessageRate = ({
	messageId,
	chatId,
	score,
	className,
}: {
	messageId: ChatMessage["id"];
	chatId: Chat["id"];
	score?: ApiGetScoresResponseData;
	className?: string;
}) => {
	const [optimisticScore, setOptimisticScore] = useState<
		number | undefined | null
	>(score?.value);

	const { mutate: rateMessage } = useRateChatMessageMutation({
		onMutate: ({ sentiment }) => {
			setOptimisticScore(sentiment);
		},
		onError: () => {
			setOptimisticScore(score?.value);
		},
	});

	useEffect(() => {
		setOptimisticScore(score?.value);
	}, [
		score?.value,
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
			label: "Very much",
			value: 10,
		},
		{
			label: "A bit",
			value: 5,
		},
		{
			label: "Not really",
			value: -5,
		},
		{
			label: "Not at all",
			value: -10,
		},
	];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Action
						label="Rate response"
						tooltip="Rate how helpful this response was for your learning"
						className={cn(
							className,
							optimisticScore &&
								"bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary",
						)}
					>
						<StarIcon
							fill={optimisticScore ? "currentColor" : "none"}
							className="size-3"
						/>
					</Action>
				}
			/>
			<DropdownMenuContent align="start" className="w-48">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="text-xs">
						Was this response helpful for your learning?
					</DropdownMenuLabel>
					<DropdownMenuSeparator />

					{ratings.map((rating) => (
						<DropdownMenuItem
							key={rating.value}
							onClick={() => handleRate(rating.value)}
							className={cn(
								"cursor-pointer",
								optimisticScore === rating.value &&
									"bg-primary/10 text-primary",
							)}
						>
							<span className="flex items-center gap-2">
								{optimisticScore === rating.value && (
									<CheckIcon className="size-3" />
								)}
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
