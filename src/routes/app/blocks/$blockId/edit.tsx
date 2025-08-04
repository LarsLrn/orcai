import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DatabaseBlockForm } from "@/components/blocks/database-block-form";
import { TemplateBlockForm } from "@/components/blocks/template-block-form";
import type { DatabaseBlock, TemplateBlock } from "@/db/schema/block";
import type { Block } from "@/lib/orpc/contracts/block";
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

// Type guards to help TypeScript narrow the types
function isTemplateBlock(block: Block): block is TemplateBlock {
	return block.config.type === "template";
}

function isDatabaseBlock(block: Block): block is DatabaseBlock {
	return block.config.type === "database";
}

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
			{isDatabaseBlock(block.data) && <DatabaseBlockForm block={block.data} />}
		</>
	);
}
