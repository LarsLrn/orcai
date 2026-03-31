import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DisplayPoint } from "@/components/documents/chunks/display-point";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/blocks/$blockId/points")({
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		await queryClient.ensureQueryData(
			orpc.assetPoint.list.queryOptions({
				input: {
					filters: {
						blockId,
						limit: 1000,
					},
				},
			}),
		);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Points",
			},
		],
	}),
});

function RouteComponent() {
	const { blockId } = Route.useParams();
	const { data: assetPoints } = useSuspenseQuery(
		orpc.assetPoint.list.queryOptions({
			input: {
				filters: {
					blockId,
					limit: 1000,
				},
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Points</PageTitle>
			</PageHeader>

			<PageContent className="grid gap-4">
				{assetPoints.data.map((point) => (
					<DisplayPoint key={point.id} point={point} />
				))}
			</PageContent>
		</Page>
	);
}
