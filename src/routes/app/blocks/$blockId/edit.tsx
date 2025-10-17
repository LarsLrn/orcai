import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DatabaseBlockForm } from "@/components/blocks/database-block-form";
import { ImageGenerationBlockForm } from "@/components/blocks/image-generation-block-form";
import { TemplateBlockForm } from "@/components/blocks/template-block-form";
import {
	isDatabaseBlock,
	isImageGenerationBlock,
	isTemplateBlock,
} from "@/lib/orpc/schemas/block";
import { blockQueryOptions } from "@/lib/query-options/block";

export const Route = createFileRoute("/app/blocks/$blockId/edit")({
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
	const { blockId } = Route.useParams();
	const { data: block } = useSuspenseQuery(
		blockQueryOptions.find({
			input: { id: blockId },
		}),
	);

	return (
		<>
			{isTemplateBlock(block.data) && <TemplateBlockForm block={block.data} />}
			{isDatabaseBlock(block.data) && block.assets && (
				<DatabaseBlockForm block={block.data} assetIds={block.assets} />
			)}
			{isImageGenerationBlock(block.data) && (
				<ImageGenerationBlockForm block={block.data} />
			)}
		</>
	);
}
