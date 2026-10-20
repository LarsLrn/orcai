import { isDatabaseBlock, isTemplateBlock } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DatabaseBlockForm } from "@/components/blocks/database-block/form/database-block-form";
import { TemplateBlockForm } from "@/components/blocks/template-block/form/template-block-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { ensureEntityCapability } from "@/lib/authz/route-guards";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/hub/blocks/$blockId/edit")({
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		await ensureEntityCapability({
			queryClient,
			entityType: "block",
			entityId: blockId,
			permission: "edit",
			redirectTo: "/app/hub/behaviour",
		});
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.blocks_edit_page_meta_title(),
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
				<PageTitle>
					{isTemplateBlock(block.data)
						? m.blocks_edit_template_page_title()
						: m.blocks_edit_database_page_title()}
				</PageTitle>
			</PageHeader>
			<PageContent>
				{isTemplateBlock(block.data) ? (
					<TemplateBlockForm action="update" block={block.data} />
				) : null}
				{isDatabaseBlock(block.data) ? (
					<DatabaseBlockForm
						action="update"
						block={block.data}
						assets={block.assets}
					/>
				) : null}
			</PageContent>
		</Page>
	);
}
