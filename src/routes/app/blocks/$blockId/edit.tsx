import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BlockForm } from "@/components/blocks/block-form";
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

	return <BlockForm block={block.data} />;
}
