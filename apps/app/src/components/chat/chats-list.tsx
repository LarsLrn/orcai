import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { MessagesSquareIcon, MoreHorizontalIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { AnimatedGroup } from "@/components/ui/motion/animated-group";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { ChatActionsDropdown } from "./chat-actions-dropdown";

const ChatsList = ({
	limit,
	...props
}: {
	limit?: number;
} & ComponentProps<"div">) => {
	const pageSize = limit ?? 100;
	const { data, status } = useQuery(
		orpc.chat.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize,
			},
		}),
	);

	if (status === "pending") {
		return <div>Loading...</div>;
	}

	if (!data?.data || data.data.length === 0) {
		return (
			<Card className="border-dashed" {...props}>
				<CardHeader className="text-center">
					<CardTitle className="font-semibold text-xl">No chats yet</CardTitle>
					<CardDescription className="mt-4 flex flex-col items-center gap-4">
						Start your first conversation by selecting a chatbot or jumping
						straight in.
					</CardDescription>
				</CardHeader>
				<CardFooter className="flex justify-center">
					<Link
						to="/app/chat/setup"
						className={buttonVariants({
							variant: "outline",
						})}
					>
						Start a chat
					</Link>
				</CardFooter>
			</Card>
		);
	}

	return (
		<AnimatedGroup
			className={cn(
				"grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
				props.className,
			)}
			preset="fade"
			{...props}
		>
			{data.data.map((chat) => (
				<Link
					to={"/app/chat/$chatId"}
					params={{
						chatId: chat.id,
					}}
					key={chat.id}
				>
					<Card className="relative h-full transition-all hover:border-primary/50 hover:shadow-md">
						<ChatActionsDropdown chatId={chat.id} title={chat.title}>
							<Button
								variant="ghost"
								className="absolute top-2 right-2 h-8 w-8 p-0 data-[state=open]:bg-muted"
								onClick={(e) => e.preventDefault()}
							>
								<MoreHorizontalIcon className="h-4 w-4" />
								<span className="sr-only">Open menu</span>
							</Button>
						</ChatActionsDropdown>

						<CardHeader className="pb-2">
							<CardTitle className="line-clamp-1 w-[calc(100%-1rem)] text-base">
								{chat.title}
							</CardTitle>
							{chat.updatedAt && (
								<CardDescription className="text-xs">
									Last updated: {format(chat.updatedAt, "MMM dd, yyyy HH:mm")}
								</CardDescription>
							)}
						</CardHeader>
						<CardContent className="pt-0">
							<div className="flex items-center text-muted-foreground text-sm">
								<MessagesSquareIcon className="mr-2 size-4" />
								Continue chat
							</div>
						</CardContent>
					</Card>
				</Link>
			))}
		</AnimatedGroup>
	);
};

export { ChatsList };
