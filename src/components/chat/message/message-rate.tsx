import { useMutation } from "@tanstack/react-query";
import type { ApiGetScoresResponseData } from "langfuse";
import { CheckIcon, StarIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Action } from "@/components/ai-elements/actions";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";
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
	const { trackEvent } = useUmami();
	const { mutateAsync: rateMessage } = useMutation(
		orpc.chatMessage.rate.mutationOptions(),
	);

	const handleRate = (sentiment: number) => {
		toast.promise(
			rateMessage({
				id: messageId,
				chatId,
				sentiment,
			}),
			{
				loading: "Rating...",
				success: () => {
					setOptimisticScore(sentiment);
					trackEvent("message-rate", {
						messageId,
						sentiment,
						chatId,
					});
					return "Thank you for your feedback!";
				},
				error: (error) => {
					setOptimisticScore(score?.value);

					return {
						message: "Failed to rate",
						description: error.message,
					};
				},
			},
		);
	};

	const ratings = [
		{ label: "Very much", value: 10 },
		{ label: "A bit", value: 5 },
		{ label: "Not really", value: -5 },
		{ label: "Not at all", value: -10 },
	];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
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
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-48">
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
							optimisticScore === rating.value && "bg-primary/10 text-primary",
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
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { MessageRate };
