import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/app/page";
import { ChatsList } from "@/components/chat/chats-list";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/app/chat/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>Chats</PageTitle>
				<PageAction>
					<Link to="/app/chat/setup" className={buttonVariants()}>
						New Chat
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent>
				<ChatsList />
			</PageContent>
		</Page>
	);
}
