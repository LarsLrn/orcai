import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AssetForm } from "@/components/assets/form/asset-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { ensureEntityCapability } from "@/lib/router/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/library/assets/$assetId/edit")({
	beforeLoad: async ({ context: { queryClient }, params: { assetId } }) => {
		await ensureEntityCapability({
			queryClient,
			entityType: "asset",
			entityId: assetId,
			permission: "edit",
		});
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.assets_edit_page_title(),
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
				<PageTitle>{m.assets_edit_page_title()}</PageTitle>
			</PageHeader>
			<PageContent>
				<AssetForm asset={asset.data} />
			</PageContent>
		</Page>
	);
}
