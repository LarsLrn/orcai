import { createFileRoute } from "@tanstack/react-router";
import { BlockDetailPage } from "@/components/blocks/block-detail-page";

export const Route = createFileRoute("/app/library/behaviours/$blockId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { blockId } = Route.useParams();

	return <BlockDetailPage blockId={blockId} />;
}
