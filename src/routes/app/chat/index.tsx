import { createFileRoute, Link } from "@tanstack/react-router";
import { ChatsList } from "@/components/chat/chats-list";
import { buttonVariants } from "@/components/ui/button";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";

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
