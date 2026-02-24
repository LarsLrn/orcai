import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/app/page";
import { AssetForm } from "@/components/documents/form/asset-form";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/assets/$assetId/edit")({
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
			input: { id: assetId },
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Edit Asset</PageTitle>
			</PageHeader>
			<PageContent>
				<AssetForm asset={asset.data} />
			</PageContent>
		</Page>
	);
}
