import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ChatsList } from "./chats-list";
import { NewChatButton } from "./new-chat-button";

const ChatsPreview = () => {
	return (
		<div className="col-span-3 space-y-4">
			<div className="flex items-center justify-between">
				<h2 id="tour-history" className="font-semibold text-2xl tracking-tight">
					Your Recent Conversations
				</h2>
				<div className="flex items-center gap-2">
					<Link
						to={"/app/chat"}
						className={buttonVariants({ variant: "outline" })}
					>
						Show all
					</Link>
					<NewChatButton id="tour-newChat" size="icon" variant="outline">
						<PlusIcon />
					</NewChatButton>
				</div>
			</div>
			<ChatsList limit={6} />
		</div>
	);
};

export { ChatsPreview };
