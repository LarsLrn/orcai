import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AssetForm } from "@/components/documents/form/asset-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/assets/$assetId/edit")({
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
	const { assetId } = Route.useParams();
	const { data: asset } = useSuspenseQuery(
		orpc.asset.find.queryOptions({
			input: {
				id: assetId,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Edit Content Item</PageTitle>
			</PageHeader>
			<PageContent>
				<AssetForm asset={asset.data} />
			</PageContent>
		</Page>
	);
}
