import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BotBuilderForm } from "@/components/blocks/builder/bot-builder-form";
import type { BotInsert, BotUpdate } from "@/lib/orpc/contracts/bot";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/bots/$botId/edit")({
	loader: async ({ context: { queryClient }, params: { botId } }) => {
		await queryClient.ensureQueryData(
			orpc.bot.find.queryOptions({
				input: { id: botId },
				queryKey: orpc.bot.find.key({
					input: { id: botId },
				}),
			}),
		);
	},
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
	const queryClient = useQueryClient();
	const { botId } = Route.useParams();
	const navigate = useNavigate();

	const { data: bot } = useSuspenseQuery(
		orpc.bot.find.queryOptions({
			input: { id: botId },
			queryKey: orpc.bot.find.key({
				input: { id: botId },
			}),
		}),
	);

	const { mutateAsync: updateBot } = useMutation(
		orpc.bot.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.bot.key() });
			},
		}),
	);

	const handleBotSubmit = (data: BotInsert) => {
		// TODO: Handle BotUpdate type properly
		toast.promise(updateBot(data as BotUpdate), {
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
