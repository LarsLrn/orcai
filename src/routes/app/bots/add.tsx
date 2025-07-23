import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BotBuilderForm } from "@/components/blocks/builder/bot-builder-form";
import type { BotInsert } from "@/lib/orpc/contracts/bot";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/bots/add")({
	loader: async ({ context: { queryClient } }) => {
		// Preload blocks data for the form
		await queryClient.ensureQueryData(
			orpc.block.list.queryOptions({
				input: { pageIndex: 0, pageSize: 50 },
				queryKey: orpc.block.list.key({
					input: { pageIndex: 0, pageSize: 50 },
				}),
			}),
		);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Add",
			},
		],
	}),
});

function RouteComponent() {
	const { queryClient } = Route.useRouteContext();
	const navigate = useNavigate();
	const { mutateAsync: createBot } = useMutation(
		orpc.bot.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.bot.key() });
			},
		}),
	);

	const handleBotSubmit = (data: BotInsert) => {
		toast.promise(createBot(data), {
			loading: "Creating bot...",
			success: (result) => {
				navigate({ to: "/app/bots/$botId", params: { botId: result.data.id } });
				return "Bot created successfully";
			},
			error: "Failed to create bot",
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

			<BotBuilderForm onSubmit={handleBotSubmit} />
		</div>
	);
}
