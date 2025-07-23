import { createFileRoute } from "@tanstack/react-router";
import { ChatsList } from "@/components/chat/chats-list";
import { NewChatButton } from "@/components/chat/new-chat-button";

export const Route = createFileRoute("/app/chat/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<h4 className="max-w-xl font-regular text-3xl tracking-tighter md:text-5xl">
					Chats
				</h4>
				<div className="flex gap-2">
					<NewChatButton>New Chat</NewChatButton>
				</div>
			</div>

			<ChatsList />
		</div>
	);
}
