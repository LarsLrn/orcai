import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BotBuilderForm } from "@/components/blocks/builder/bot-builder-form";
import type { BotUpdate } from "@/lib/orpc/schemas/bot";
import { botQueryOptions } from "@/lib/query-options/bot";

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
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: bot } = useSuspenseQuery(
		botQueryOptions.find({
			input: { id: botId },
		}),
	);

	const { mutateAsync: updateBot } = useMutation(
		botQueryOptions.update(queryClient),
	);

	const handleBotSubmit = (data: Omit<BotUpdate, "id">) => {
		// TODO: Handle BotUpdate type properly
		toast.promise(updateBot({ id: botId, ...data }), {
			loading: "Updating bot...",
			success: async (result) => {
				await navigate({
					to: "/app/bots/$botId",
					params: { botId: result.data.id },
				});
				return "Bot updated successfully";
			},
			error: "Failed to update bot",
		});
	};

	return (
		<div className="p-6">
			<div className="mb-6">
				<h1 className="font-bold text-2xl">Bot Builder</h1>
				<p className="text-muted-foreground">
					Create and configure your bot by selecting the blocks you want to
					activate
				</p>
			</div>

			<BotBuilderForm initialData={bot.data} onSubmit={handleBotSubmit} />
		</div>
	);
}
