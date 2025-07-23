import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BotBuilderForm } from "@/components/blocks/builder/bot-builder-form";
import type { BotInsert } from "@/lib/orpc/contracts/bot";
import { blockQueryOptions } from "@/lib/query-options/block";
import { botQueryOptions } from "@/lib/query-options/bot";

export const Route = createFileRoute("/app/bots/add")({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData(
			blockQueryOptions.list({
				input: { pageIndex: 0, pageSize: 100 },
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
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { mutateAsync: createBot } = useMutation(
		botQueryOptions.create(queryClient),
	);

	const handleBotSubmit = (data: BotInsert) => {
		toast.promise(createBot(data), {
			loading: "Creating bot...",
			success: async (result) => {
				await navigate({
					to: "/app/bots/$botId",
					params: { botId: result.data.id },
				});
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
