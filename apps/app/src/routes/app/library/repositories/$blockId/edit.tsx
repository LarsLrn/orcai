import { isRepository } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RepositoryForm } from "@/components/blocks/repository/form/repository-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { ensureEntityCapability } from "@/lib/authz/route-guards";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/library/repositories/$blockId/edit")(
	{
		loader: async ({ context: { queryClient }, params: { blockId } }) => {
			await ensureEntityCapability({
				queryClient,
				entityType: "block",
				entityId: blockId,
				permission: "edit",
				redirectTo: "/app/library/repositories",
			});
		},
		component: RouteComponent,
		head: () => ({
			meta: [
				{
					title: m.blocks_edit_repository_page_title(),
				},
			],
		}),
	},
);

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
				<PageTitle>{m.blocks_edit_repository_page_title()}</PageTitle>
			</PageHeader>
			<PageContent>
				{isRepository(block.data) ? (
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
