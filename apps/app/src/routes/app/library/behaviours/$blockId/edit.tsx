import { isBehaviour } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BehaviourForm } from "@/components/blocks/behaviour/form/behaviour-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { ensureEntityCapability } from "@/lib/authz/route-guards";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/library/behaviours/$blockId/edit")({
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		await ensureEntityCapability({
			queryClient,
			entityType: "block",
			entityId: blockId,
			permission: "edit",
			redirectTo: "/app/library/behaviours",
		});
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.blocks_edit_behaviour_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	const { blockId } = Route.useParams();
	const { data: block } = useSuspenseQuery(
		orpc.block.find.queryOptions({
			input: {
				id: blockId,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.blocks_edit_behaviour_page_title()}</PageTitle>
			</PageHeader>
			<PageContent>
				{isBehaviour(block.data) ? (
					<BehaviourForm action="update" block={block.data} />
				) : null}
			</PageContent>
		</Page>
	);
}
