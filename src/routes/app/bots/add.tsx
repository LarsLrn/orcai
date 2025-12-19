import { createFileRoute } from "@tanstack/react-router";
import { BotForm } from "@/components/blocks/form/bot-form";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/bots/add")({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData(
			orpc.block.list.queryOptions({
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
	return (
		<div className="p-6">
			<div className="mb-6">
				<h1 className="font-bold text-2xl">Bot Builder</h1>
				<p className="text-muted-foreground">
					Create and configure your bot by selecting the blocks you want to
					activate
				</p>
			</div>

			<BotForm action="create" />
		</div>
	);
}
