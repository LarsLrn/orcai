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

export const Route = createFileRoute("/app/hub/bots/add")({
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
		<Page>
			<PageHeader>
				<PageTitle>Bot Builder</PageTitle>
				<PageDescription>
					Create and configure your bot by selecting the blocks you want to
					activate
				</PageDescription>
			</PageHeader>
			<PageContent>
				<BotForm action="create" />
			</PageContent>
		</Page>
	);
}
