import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BlockForm } from "@/components/blocks/block-form";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/(blocks)/blocks_/$blockId/edit")({
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		await queryClient.ensureQueryData(
			orpc.block.find.queryOptions({
				input: { id: blockId },
				queryKey: orpc.block.find.key({ input: { id: blockId } }),
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { blockId } = Route.useParams();
	const { data: block } = useSuspenseQuery(
		orpc.block.find.queryOptions({
			input: { id: blockId },
			queryKey: orpc.block.find.key({ input: { id: blockId } }),
		}),
	);

	return <BlockForm block={block.data} />;
}
