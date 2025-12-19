import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BotForm } from "@/components/blocks/form/bot-form";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/bots/$botId/edit")({
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
		<div className="p-6">
			<div className="mb-6">
				<h1 className="font-bold text-2xl">Bot Builder</h1>
				<p className="text-muted-foreground">
					Create and configure your bot by selecting the blocks you want to
					activate
				</p>
			</div>

			<BotForm bot={bot.data} blockIds={bot.data.blockIds} action="update" />
		</div>
	);
}
