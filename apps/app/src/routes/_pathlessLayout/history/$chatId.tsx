import { chatIdSchema } from "@orcai/schema";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { Chat } from "@/components/chat/chat";
import { downloadChat } from "@/components/chat/chat-history";
import { loadChatPage } from "@/components/chat/chat-page";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { parseParam } from "@/lib/router/not-found";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_pathlessLayout/history/$chatId")({
	params: {
		parse: (params) => ({
			chatId: parseParam(chatIdSchema, params.chatId),
		}),
	},
	loader: ({ params: { chatId }, context: { queryClient } }) =>
		loadChatPage(
			{
				queryClient,
				chatId,
			},
			(chat) => {
				// A chat the user can continue opens in the app.
				if (chat.readOnly === null) {
					throw redirect({
						to: "/app/chat/$chatId",
						params: {
							chatId,
						},
					});
				}
			},
		),
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.chat.data.title ?? m.chat_history_page_title(),
			},
		],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { chatId } = Route.useParams();
	const loaded = Route.useLoaderData();
	const chat = loaded.chat.data;

	const download = () =>
		downloadChat({
			chatId,
		}).catch((error: unknown) => {
			toast.error(m.chat_download_failed_toast_error(), {
				description: reasonMessageOf(error),
			});
		});

	return (
		<div className="w-full max-w-3xl space-y-4">
			<div className="flex items-center justify-between gap-2">
				<Link
					to="/history"
					className={buttonVariants({
						variant: "link",
					})}
				>
					<ArrowLeftIcon />
					{m.chat_history_page_title()}
				</Link>
				<Button variant="outline" onClick={() => void download()}>
					<DownloadIcon />
					{m.chat_actions_download_action()}
				</Button>
			</div>
			<h1 className="px-1 font-semibold text-xl tracking-tight">
				{chat.title ?? m.chat_title_placeholder()}
			</h1>
			<Card className="h-[70dvh] min-h-0 py-0">
				<Chat
					id={chatId}
					page={loaded.messages}
					variant={chat.kind === "assistant" ? "assistant" : "chat"}
				/>
			</Card>
		</div>
	);
}
