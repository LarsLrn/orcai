import { isBehaviour, isRepository } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BehaviourForm } from "@/components/blocks/behaviour/form/behaviour-form";
import { RepositoryForm } from "@/components/blocks/repository/form/repository-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { resourceVisibilityQuery } from "@/hooks/authz/use-resource-access";
import { ensureEntityCapability } from "@/lib/authz/route-guards";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const TITLES = {
	behaviour: m.blocks_edit_behaviour_page_title,
	repository: m.blocks_edit_repository_page_title,
};

export const Route = createFileRoute("/app/library/$kind/$blockId/edit")({
	beforeLoad: async ({ context: { queryClient }, params: { blockId } }) => {
		await ensureEntityCapability({
			queryClient,
			entityType: "block",
			entityId: blockId,
			permission: "edit",
		});
	},
	// A repository's listed note fails only itself.
	loader: async ({ context: { queryClient }, params: { kind, blockId } }) => {
		if (kind === "repository")
			await Promise.allSettled([
				queryClient.query(
					resourceVisibilityQuery({
						type: "block",
						id: blockId,
					}),
				),
			]);
	},
	component: RouteComponent,
	head: ({ params }) => ({
		meta: [
			{
				title: TITLES[params.kind](),
			},
		],
	}),
});

function RouteComponent() {
	const { kind, blockId } = Route.useParams();
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
				<PageTitle>{TITLES[kind]()}</PageTitle>
			</PageHeader>
			<PageContent>
				{isBehaviour(block.data) ? (
					<BehaviourForm action="update" block={block.data} />
				) : isRepository(block.data) ? (
					<RepositoryForm
						action="update"
						block={block.data}
						assets={block.assets}
					/>
				) : null}
			</PageContent>
		</Page>
	);
}
