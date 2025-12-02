import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BotBlocks } from "@/components/bot/bot-blocks";
import { BotConfiguration } from "@/components/bot/bot-configuration";
import { BotHeader } from "@/components/bot/bot-header";
import { BotMetadata } from "@/components/bot/bot-metadata";
import { BotQuickActions } from "@/components/bot/bot-quick-actions";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/bots/$botId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { botId } = Route.useParams();

	const { data: bot } = useSuspenseQuery(
		orpc.bot.find.queryOptions({
			input: { id: botId },
		}),
	);

	const { data: blocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: { filters: { botId } },
		}),
	);

	return (
		<div className="container mx-auto space-y-6 p-6">
			<BotHeader bot={bot.data} />
			<div className="grid gap-6 lg:grid-cols-3">
				{/* Main Content */}
				<div className="space-y-6 lg:col-span-2">
					<BotConfiguration bot={bot.data} />
					<BotBlocks blocks={blocks.data} />
				</div>

				{/* Aside */}
				<div className="space-y-6">
					<BotMetadata bot={bot.data} />
					<BotQuickActions bot={bot.data} />
				</div>
			</div>
		</div>
	);
}
