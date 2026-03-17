import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DatabaseBlockForm } from "@/components/blocks/database-block/form/database-block-form";
import { ImageGenerationBlockForm } from "@/components/blocks/image-generation-block/form/image-generation-block-form";
import { TemplateBlockForm } from "@/components/blocks/template-block/form/template-block-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import {
	isDatabaseBlock,
	isImageGenerationBlock,
	isTemplateBlock,
} from "@/lib/orpc/schemas/block";

export const Route = createFileRoute("/app/hub/blocks/$blockId/edit")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Edit Block",
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
						? "Edit AI Behavior"
						: isDatabaseBlock(block.data)
							? "Edit Content Collection"
							: "Edit Image Generation"}
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
				{isImageGenerationBlock(block.data) ? (
					<ImageGenerationBlockForm action="update" block={block.data} />
				) : null}
			</PageContent>
		</Page>
	);
}
