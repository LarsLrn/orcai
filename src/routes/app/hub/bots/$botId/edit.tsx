import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/app/page";
import { BotForm } from "@/components/blocks/form/bot-form";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/bots/$botId/edit")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Edit",
			},
		],
	}),
});

function RouteComponent() {
	const { botId } = Route.useParams();

	const { data: bot } = useSuspenseQuery(
		orpc.bot.find.queryOptions({
			input: { id: botId },
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Bot Builder</PageTitle>
				<PageDescription>
					Create and configure your bot by selecting the blocks you want to
					activate
				</PageDescription>
			</PageHeader>

			<PageContent>
				<BotForm bot={bot.data} blockIds={bot.data.blockIds} action="update" />
			</PageContent>
		</Page>
	);
}
