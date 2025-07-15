import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiGetScoresResponseData } from "langfuse";
import { CheckIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Chat } from "@/db/schema/chat";
import type { ChatMessage } from "@/db/schema/chat-message";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

const MessageRate = ({
	messageId,
	chatId,
	score,
	className,
	...props
}: {
	messageId: ChatMessage["id"];
	chatId: Chat["id"];
	score?: ApiGetScoresResponseData;
} & ComponentProps<"div">) => {
	const [optimisticScore, setOptimisticScore] = useState<
		number | undefined | null
	>(score?.value);
	const { trackEvent } = useUmami();
	const queryClient = useQueryClient();
	const { mutateAsync: rateMessage } = useMutation(
		orpc.chatMessage.rate.mutationOptions({
			onSuccess() {
				queryClient.invalidateQueries({
					queryKey: orpc.chatMessage.key({ input: { chatId } }),
				});
			},
		}),
	);

	const handleRate = async (sentiment: number) => {
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
		<div
			className={cn(
				"flex flex-col gap-0.5 rounded-sm border p-1.5 pt-0.5 pb-1",
				className,
			)}
			{...props}
		>
			<span className="w-full px-1 text-muted-foreground text-xs">
				Was this response helpful for your learning?
			</span>
			<div className="flex items-center gap-2">
				{ratings.map((rating) => (
					<RateButton
						onClick={() => handleRate(rating.value)}
						checked={optimisticScore === rating.value}
						key={rating.value}
					>
						{rating.label}
					</RateButton>
				))}
			</div>
		</div>
	);
};

const RateButton = ({
	checked,
	...props
}: { checked: boolean } & ComponentProps<"button">) => {
	return (
		<Button
			variant="ghost"
			className={cn("h-5 px-1 text-xs", checked && "bg-primary/30")}
			{...props}
		>
			<span className="flex items-center gap-1">
				{checked && <CheckIcon className="size-3" />}
				{props.children}
			</span>
		</Button>
	);
};

export { MessageRate };
