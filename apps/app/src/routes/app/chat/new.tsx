import { botIdSchema } from "@orcai/schema";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { NewChat } from "@/components/chat/new-chat";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
	botId: botIdSchema.optional(),
});

export const Route = createFileRoute("/app/chat/new")({
	validateSearch: searchSchema,
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.chat_new_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	const { botId } = Route.useSearch();

	return (
		<div className="-mx-2 -mb-6 h-[calc(100dvh-72px)] sm:-mx-2">
			<NewChat botId={botId} />
		</div>
	);
}
